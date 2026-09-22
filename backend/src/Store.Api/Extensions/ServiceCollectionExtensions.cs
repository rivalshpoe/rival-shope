using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using StackExchange.Redis;
using Store.Api.Filters;
using Store.Api.Middleware;
using Store.Api.Models;
using Store.Api.Services;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;

namespace Store.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public const string FrontendCorsPolicy = "Frontend";

    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration configuration, IHostEnvironment env)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentAdminService, CurrentAdminService>();
        services.AddScoped<IRequestContext, HttpRequestContext>();
        services.AddScoped<IdempotencyFilter>();

        services.AddControllers(options =>
            {
                options.Filters.Add(new ProducesAttribute("application/json"));
            })
            .AddJsonOptions(o =>
            {
                o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
                o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
                o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            })
            .ConfigureApiBehaviorOptions(o =>
            {
                // Body-binding / malformed JSON errors → 400 BAD_REQUEST envelope (FluentValidation owns 422).
                o.InvalidModelStateResponseFactory = ctx =>
                {
                    var errors = new Dictionary<string, string>();
                    foreach (var (rawKey, state) in ctx.ModelState)
                    {
                        if (state is not { Errors.Count: > 0 }) continue;
                        // "$" / "$.items[0].quantity" (JSON paths) → "body" / "items[0].quantity"
                        var key = rawKey.TrimStart('$', '.');
                        key = string.IsNullOrEmpty(key) ? "body" : JsonNamingPolicy.CamelCase.ConvertName(key);
                        errors.TryAdd(key, "قيمة غير صالحة.");
                    }
                    var payload = new ApiError
                    {
                        ErrorCode = ErrorCodes.BadRequest,
                        Message = "الطلب غير صالح بنيويًا، يرجى التحقق من البيانات المرسلة.",
                        CorrelationId = ctx.HttpContext.Items[CorrelationIdMiddleware.ItemKey] as string ?? ctx.HttpContext.TraceIdentifier,
                        FieldErrors = errors.Count > 0 ? errors : null
                    };
                    return new BadRequestObjectResult(payload);
                };
            });

        services.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            o.KnownIPNetworks.Clear();
            o.KnownProxies.Clear();
            o.ForwardLimit = 2;
        });

        // HSTS (Production only, see Program.cs): 1 year + subdomains, as required by spec §12.
        services.AddHsts(o =>
        {
            o.MaxAge = TimeSpan.FromDays(365);
            o.IncludeSubDomains = true;
            o.Preload = false;
        });
        services.AddHttpsRedirection(o =>
        {
            o.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
            o.HttpsPort = configuration.GetValue<int?>("HttpsRedirection:HttpsPort") ?? 443;
        });

        AddCors(services, configuration);
        AddAuth(services, configuration);
        AddSwagger(services);
        AddHealth(services, configuration);

        return services;
    }

    private static void AddCors(IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                      ?? configuration["Cors:AllowedOrigins"]?.Split([';', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                      ?? [];

        services.AddCors(options => options.AddPolicy(FrontendCorsPolicy, policy =>
        {
            if (origins.Length == 0)
            {
                // No origins configured ⇒ deny cross-origin browsers entirely (never AllowAnyOrigin).
                policy.WithOrigins("https://invalid.local");
                return;
            }
            policy.WithOrigins(origins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()
                .WithExposedHeaders(CorrelationIdMiddleware.HeaderName, "Retry-After", "Idempotent-Replayed")
                .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
        }));
    }

    private static void AddAuth(IServiceCollection services, IConfiguration configuration)
    {
        var secret = configuration["Jwt:Secret"] ?? string.Empty;
        var issuer = configuration["Jwt:Issuer"] ?? "rival-api";
        var audience = configuration["Jwt:Audience"] ?? "rival-admin";
        // A short/missing secret fails loudly at first token issue (JwtTokenGenerator); here we only need a valid key object.
        var keyBytes = Encoding.UTF8.GetBytes(secret.Length >= 32 ? secret : secret.PadRight(32, '_'));

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = true,
                    ValidAudience = audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
                    RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                    NameClaimType = "email"
                };
                options.Events = new JwtBearerEvents
                {
                    OnChallenge = async ctx =>
                    {
                        ctx.HandleResponse();
                        await WriteAuthError(ctx.Response, ctx.HttpContext, 401, ErrorCodes.Unauthorized, "غير مصرح. يرجى تسجيل الدخول.");
                    },
                    OnForbidden = ctx => WriteAuthError(ctx.Response, ctx.HttpContext, 403, ErrorCodes.Forbidden, "ليس لديك صلاحية للوصول إلى هذا المورد.")
                };
            });

        services.AddAuthorization();
    }

    private static async Task WriteAuthError(HttpResponse response, HttpContext http, int status, string code, string message)
    {
        if (response.HasStarted) return;
        response.StatusCode = status;
        response.ContentType = "application/json; charset=utf-8";
        var payload = new ApiError
        {
            ErrorCode = code,
            Message = message,
            CorrelationId = http.Items[CorrelationIdMiddleware.ItemKey] as string ?? http.TraceIdentifier
        };
        await response.WriteAsync(JsonSerializer.Serialize(payload, JsonDefaults.Options));
    }

    private static void AddSwagger(IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Rival Store API",
                Version = "v1",
                Description = "Arabic luxury e-commerce backend. All responses use `{ success, data }` / `{ success:false, errorCode, message, correlationId, fieldErrors? }`."
            });
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Admin access token from /api/v1/admin/auth/verify-otp"
            });
            c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", doc)] = new List<string>() });
            c.CustomSchemaIds(t => t.FullName!.Replace("+", "."));
        });
    }

    private static void AddHealth(IServiceCollection services, IConfiguration configuration)
    {
        var builder = services.AddHealthChecks();
        var pg = configuration.GetConnectionString("Postgres");
        if (!string.IsNullOrWhiteSpace(pg))
            builder.AddNpgSql(pg, name: "postgres", tags: ["ready"], timeout: TimeSpan.FromSeconds(5));

        // Redis is optional (in-memory fallback) ⇒ an outage degrades health (200) instead of failing it (503).
        var redis = configuration["Redis:ConnectionString"];
        if (!string.IsNullOrWhiteSpace(redis) && !redis.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase))
            builder.AddRedis(sp => sp.GetRequiredService<IConnectionMultiplexer>(), name: "redis", failureStatus: HealthStatus.Degraded, tags: ["ready"], timeout: TimeSpan.FromSeconds(3));
    }
}
