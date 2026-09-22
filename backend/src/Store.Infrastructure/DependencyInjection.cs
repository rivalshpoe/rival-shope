using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using StackExchange.Redis;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Caching;
using Store.Infrastructure.Email;
using Store.Infrastructure.Images;
using Store.Infrastructure.Options;
using Store.Infrastructure.Persistence;
using Store.Infrastructure.Persistence.Seed;
using Store.Infrastructure.Security;
using Store.Infrastructure.Storage;

namespace Store.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        // Secrets are validated eagerly at host start (fail fast outside Development, spec §12).
        services.AddOptions<JwtOptions>().Bind(configuration.GetSection(JwtOptions.Section))
            .Validate(o => IsStrongSecret(o.Secret, 32), "Jwt:Secret must be a random string of at least 32 characters (openssl rand -base64 48).")
            .Validate(o => o.AccessTokenMinutes is > 0 and <= 60, "Jwt:AccessTokenMinutes must be between 1 and 60.")
            .Validate(o => o.RefreshTokenDays is > 0 and <= 30, "Jwt:RefreshTokenDays must be between 1 and 30.")
            .ValidateOnStart();
        services.AddOptions<SecurityOptions>().Bind(configuration.GetSection(SecurityOptions.Section))
            .Validate(o => IsStrongSecret(o.DeviceHmacKey, 32), "Security:DeviceHmacKey must be a random string of at least 32 characters.")
            .Validate(o => IsStrongSecret(o.AesKey, 16), "Security:AesKey must be a base64 32-byte key (openssl rand -base64 32).")
            .ValidateOnStart();
        services.AddOptions<AdminOptions>().Bind(configuration.GetSection(AdminOptions.Section))
            .Validate(o => !string.IsNullOrWhiteSpace(o.Email) && o.Email.Contains('@'), "Admin:Email must be a valid e-mail address.")
            .ValidateOnStart();
        services.AddSingleton<IAdminSettings, AdminSettings>();

        if (!environment.IsDevelopment())
        {
            // Placeholder values from appsettings.json must never reach production.
            services.AddOptions<JwtOptions>().Validate(o => !o.Secret.Contains("dev-only", StringComparison.OrdinalIgnoreCase), "Jwt:Secret still uses the development value.");
            services.AddOptions<SecurityOptions>()
                .Validate(o => !o.DeviceHmacKey.Contains("dev-only", StringComparison.OrdinalIgnoreCase), "Security:DeviceHmacKey still uses the development value.")
                .Validate(o => o.AesKey != "ZGV2LW9ubHktYWVzLWtleS0zMi1ieXRlcy0wMTIzNDU2Nzg=", "Security:AesKey still uses the development value.");
        }

        services.Configure<ResendOptions>(configuration.GetSection(ResendOptions.Section));
        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.Section));
        services.Configure<SpacesOptions>(configuration.GetSection(SpacesOptions.Section));
        services.Configure<RedisOptions>(configuration.GetSection(RedisOptions.Section));
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.Section));
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.Section));

        AddPersistence(services, configuration);
        AddRedis(services, configuration);
        AddEmail(services, configuration, environment);
        AddStorage(services, configuration);

        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
        services.AddSingleton<IImageProcessor, ImageSharpProcessor>();
        services.AddSingleton<IOtpHasher, BcryptOtpHasher>();
        services.AddSingleton<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddSingleton<IDeviceFingerprintService, DeviceFingerprintService>();
        services.AddScoped<IInvoiceNumberGenerator, InvoiceNumberGenerator>();
        services.AddScoped<IAuditLogger, AuditLogger>();
        services.AddScoped<DbSeeder>();

        return services;
    }

    private static bool IsStrongSecret(string? value, int minLength) =>
        !string.IsNullOrWhiteSpace(value)
        && value.Length >= minLength
        && !value.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase)
        && !value.Contains("change-me", StringComparison.OrdinalIgnoreCase);

    private static void AddPersistence(IServiceCollection services, IConfiguration configuration)
    {
        var raw = configuration.GetConnectionString("Postgres")
                  ?? throw new InvalidOperationException("ConnectionStrings:Postgres is not configured.");

        // Enforce pooling defaults (spec §5) without overriding explicit values from configuration.
        var csb = new NpgsqlConnectionStringBuilder(raw);
        if (!raw.Contains("Maximum Pool Size", StringComparison.OrdinalIgnoreCase)) csb.MaxPoolSize = 100;
        if (!raw.Contains("Minimum Pool Size", StringComparison.OrdinalIgnoreCase)) csb.MinPoolSize = 5;
        if (!raw.Contains("Connection Idle Lifetime", StringComparison.OrdinalIgnoreCase)) csb.ConnectionIdleLifetime = 300;
        if (!raw.Contains("Timeout", StringComparison.OrdinalIgnoreCase)) csb.Timeout = 15;
        if (!raw.Contains("Command Timeout", StringComparison.OrdinalIgnoreCase)) csb.CommandTimeout = 30;

        var dataSource = new NpgsqlDataSourceBuilder(csb.ConnectionString).Build();
        services.AddSingleton(dataSource);

        services.AddDbContext<StoreDbContext>((sp, options) =>
        {
            options.UseNpgsql(sp.GetRequiredService<NpgsqlDataSource>(), npgsql =>
            {
                npgsql.MigrationsAssembly(typeof(StoreDbContext).Assembly.FullName);
                npgsql.CommandTimeout(30);
            });
            options.UseQueryTrackingBehavior(QueryTrackingBehavior.TrackAll);
        });
        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<StoreDbContext>());
    }

    /// <summary>
    /// Redis is optional. Empty/placeholder connection string ⇒ in-memory rate limiter, idempotency store and cache.
    /// Configured but unreachable ⇒ the Redis adapters fail over to the same in-memory implementations at runtime
    /// (one warning per outage) and switch back automatically once the connection is restored.
    /// </summary>
    private static void AddRedis(IServiceCollection services, IConfiguration configuration)
    {
        services.AddMemoryCache(o => o.SizeLimit = 50_000);
        services.AddSingleton<RedisAvailability>();
        services.AddSingleton<MemoryCacheService>();
        services.AddSingleton<MemoryRateLimiter>();
        services.AddSingleton<MemoryIdempotencyStore>();

        var connectionString = configuration["Redis:ConnectionString"];
        if (string.IsNullOrWhiteSpace(connectionString) || connectionString.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<ICacheService>(sp => sp.GetRequiredService<MemoryCacheService>());
            services.AddSingleton<IRateLimiter>(sp => sp.GetRequiredService<MemoryRateLimiter>());
            services.AddSingleton<IIdempotencyStore>(sp => sp.GetRequiredService<MemoryIdempotencyStore>());
            services.AddHostedService<RedisStartupProbe>(sp => new RedisStartupProbe(null, sp.GetRequiredService<ILogger<RedisStartupProbe>>()));
            return;
        }

        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Redis");
            var options = ConfigurationOptions.Parse(connectionString);
            options.AbortOnConnectFail = false; // never fail startup because Redis is down; reconnects in background
            options.ConnectRetry = 2;
            options.ConnectTimeout = 2000;
            options.SyncTimeout = 1500;
            options.AsyncTimeout = 1500;
            options.ClientName = "rival-api";
            var mux = ConnectionMultiplexer.Connect(options);
            mux.ConnectionFailed += (_, e) => logger.LogDebug("Redis connection failed ({FailureType}): {Message}", e.FailureType, e.Exception?.Message);
            mux.ConnectionRestored += (_, _) => logger.LogInformation("Redis connection restored");
            return mux;
        });

        services.AddSingleton<ICacheService, RedisCacheService>();
        services.AddSingleton<IRateLimiter, RedisRateLimiter>();
        services.AddSingleton<IIdempotencyStore, RedisIdempotencyStore>();
        services.AddHostedService<RedisStartupProbe>(sp =>
            new RedisStartupProbe(sp.GetRequiredService<IConnectionMultiplexer>(), sp.GetRequiredService<ILogger<RedisStartupProbe>>()));
    }

    private static void AddEmail(IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var provider = configuration["Email:Provider"];
        var useResend = string.Equals(provider, "Resend", StringComparison.OrdinalIgnoreCase)
                        || (string.IsNullOrWhiteSpace(provider) && !environment.IsDevelopment());

        // The Development sender writes the OTP to the log — never allowed outside Development (spec §12).
        if (!useResend && !environment.IsDevelopment())
            throw new InvalidOperationException("Email:Provider=Development is only allowed in the Development environment; configure Email:Provider=Resend and Resend:ApiKey.");

        if (useResend)
        {
            services.AddHttpClient<IEmailSender, ResendEmailSender>((sp, client) =>
                {
                    var baseUrl = configuration["Resend:BaseUrl"] ?? "https://api.resend.com/";
                    client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
                    client.Timeout = TimeSpan.FromSeconds(20);
                })
                .AddStandardResilienceHandler(o =>
                {
                    o.Retry.MaxRetryAttempts = 3;
                    o.Retry.Delay = TimeSpan.FromMilliseconds(400);
                    o.Retry.BackoffType = Polly.DelayBackoffType.Exponential;
                    o.Retry.UseJitter = true;
                    o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
                    o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(18);
                    o.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(30);
                    o.CircuitBreaker.MinimumThroughput = 5;
                    o.CircuitBreaker.FailureRatio = 0.5;
                    o.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(30);
                });
        }
        else
        {
            services.AddSingleton<IEmailSender, DevelopmentEmailSender>();
        }
    }

    private static void AddStorage(IServiceCollection services, IConfiguration configuration)
    {
        var provider = configuration["Storage:Provider"];
        if (string.Equals(provider, "Spaces", StringComparison.OrdinalIgnoreCase))
            services.AddSingleton<IFileStorage, SpacesFileStorage>();
        else
            services.AddSingleton<IFileStorage, LocalFileStorage>();
    }
}
