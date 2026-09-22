using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;
using Store.Application.Common.Interfaces;
using Store.Infrastructure.Persistence;

namespace Store.IntegrationTests;

/// <summary>
/// WebApplicationFactory for the API. Runs in the Development environment with Redis disabled (⇒ the in-memory
/// rate limiter / idempotency store / cache are exercised) and e-mail captured in-process so OTP codes can be read.
///
/// Database-backed tests run automatically when PostgreSQL is reachable on the test connection string
/// (default: the local <c>rival</c> database from appsettings.Development.json — the <c>rival</c> role has no
/// CREATEDB privilege, so a separate <c>rival_test</c> database is optional via <c>RIVAL_TEST_POSTGRES</c>).
/// Force the decision with <c>RIVAL_RUN_DB_TESTS=1</c> (always run) or <c>RIVAL_RUN_DB_TESTS=0</c> (always skip).
/// </summary>
public sealed class RivalApiFactory : WebApplicationFactory<Program>
{
    public const string AdminEmail = "rivalshpoe@gmail.com";

    public static readonly string PostgresConnectionString =
        Environment.GetEnvironmentVariable("RIVAL_TEST_POSTGRES")
        ?? "Host=localhost;Port=5432;Database=rival;Username=rival;Password=rival_dev_password;Timeout=3";

    private static readonly Lazy<bool> _dbReachable = new(ProbeDatabase, LazyThreadSafetyMode.ExecutionAndPublication);

    public static bool DbTestsEnabled => Environment.GetEnvironmentVariable("RIVAL_RUN_DB_TESTS") switch
    {
        "1" => true,
        "0" => false,
        _ => _dbReachable.Value
    };

    private static bool ProbeDatabase()
    {
        try
        {
            using var conn = new NpgsqlConnection(PostgresConnectionString);
            conn.Open();
            return true;
        }
        catch
        {
            return false;
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Postgres"] = PostgresConnectionString,
                ["Redis:ConnectionString"] = string.Empty, // empty ⇒ memory rate limiter / idempotency / cache
                ["Database:AutoMigrate"] = DbTestsEnabled ? "true" : "false",
                ["Database:Seed"] = DbTestsEnabled ? "true" : "false",
                ["Email:Provider"] = "Development",
                ["Storage:Provider"] = "Local",
                ["Storage:LocalPublicBaseUrl"] = "http://localhost",
                ["Admin:Email"] = AdminEmail,
                ["Jwt:Secret"] = "integration-test-secret-0123456789abcdef0123456789",
                ["Security:DeviceHmacKey"] = "integration-test-hmac-key-0123456789abcdef0123456789",
                ["Security:AesKey"] = Convert.ToBase64String(new byte[32]),
                ["Cors:AllowedOrigins:0"] = "http://localhost:3000",
                ["Serilog:MinimumLevel:Default"] = "Warning"
            });
        });
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<CapturingEmailSender>();
            services.AddSingleton<IEmailSender>(sp => sp.GetRequiredService<CapturingEmailSender>());
        });
    }

    public CapturingEmailSender Emails => Services.GetRequiredService<CapturingEmailSender>();

    /// <summary>Runs <paramref name="action"/> against a fresh <see cref="StoreDbContext"/> scope (test setup / assertions).</summary>
    public async Task<T> WithDbAsync<T>(Func<StoreDbContext, Task<T>> action)
    {
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        return await action(db);
    }

    public Task WithDbAsync(Func<StoreDbContext, Task> action) => WithDbAsync(async db => { await action(db); return 0; });

    /// <summary>Client carrying a freshly minted Admin access token for the seeded admin user (bypasses the OTP e-mail step).</summary>
    public async Task<HttpClient> CreateAdminClientAsync()
    {
        var adminId = await WithDbAsync(db => db.AdminUsers.AsNoTracking()
            .Where(a => a.Email == AdminEmail && a.IsActive).Select(a => a.Id).FirstAsync());
        var jwt = Services.GetRequiredService<IJwtTokenGenerator>().GenerateAccessToken(adminId, AdminEmail);
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt.Token);
        return client;
    }
}

/// <summary>Records every e-mail so tests can read the OTP code without a mail provider.</summary>
public sealed class CapturingEmailSender : IEmailSender
{
    private readonly List<(string To, string Subject, string Body)> _sent = [];

    public IReadOnlyList<(string To, string Subject, string Body)> Sent { get { lock (_sent) return _sent.ToList(); } }

    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        lock (_sent) _sent.Add((to, subject, htmlBody));
        return Task.CompletedTask;
    }

    /// <summary>Last 6-digit code sent to <paramref name="to"/>.</summary>
    public string? LastOtpFor(string to)
    {
        var body = Sent.LastOrDefault(m => string.Equals(m.To, to, StringComparison.OrdinalIgnoreCase)).Body;
        if (body is null) return null;
        var match = System.Text.RegularExpressions.Regex.Match(body, @">\s*(\d{6})\s*<");
        return match.Success ? match.Groups[1].Value : null;
    }
}

/// <summary>A [Fact] that is skipped unless PostgreSQL is reachable (see <see cref="RivalApiFactory.DbTestsEnabled"/>).</summary>
public sealed class DbFactAttribute : FactAttribute
{
    public DbFactAttribute()
    {
        if (!RivalApiFactory.DbTestsEnabled)
            Skip = "PostgreSQL not reachable (set RIVAL_RUN_DB_TESTS=1 / RIVAL_TEST_POSTGRES, or start the local rival database)";
    }
}
