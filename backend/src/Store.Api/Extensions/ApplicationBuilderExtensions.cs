using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Store.Api.Middleware;
using Store.Infrastructure.Options;
using Store.Infrastructure.Persistence;
using Store.Infrastructure.Persistence.Seed;

namespace Store.Api.Extensions;

public static class ApplicationBuilderExtensions
{
    /// <summary>GET /api/v1/health → { success, data: { status, checks: { postgres, redis } } } (200 healthy / 503 otherwise).</summary>
    public static IEndpointRouteBuilder MapHealthEndpoint(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapHealthChecks("/api/v1/health", new HealthCheckOptions
        {
            AllowCachingResponses = false,
            ResultStatusCodes =
            {
                [HealthStatus.Healthy] = StatusCodes.Status200OK,
                [HealthStatus.Degraded] = StatusCodes.Status200OK,
                [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable
            },
            ResponseWriter = async (context, report) =>
            {
                context.Response.ContentType = "application/json; charset=utf-8";
                var checks = new Dictionary<string, string>
                {
                    ["postgres"] = report.Entries.TryGetValue("postgres", out var pg) ? pg.Status.ToString() : "NotConfigured",
                    ["redis"] = report.Entries.TryGetValue("redis", out var redis) ? redis.Status.ToString() : "NotConfigured"
                };
                var payload = new
                {
                    success = report.Status != HealthStatus.Unhealthy,
                    data = new { status = report.Status.ToString(), checks, durationMs = (int)report.TotalDuration.TotalMilliseconds }
                };
                await context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonDefaults.Options));
            }
        }).AllowAnonymous();
        return endpoints;
    }

    /// <summary>Applies pending migrations and runs the idempotent seed when <c>Database:AutoMigrate</c> is true.</summary>
    public static async Task MigrateAndSeedAsync(this WebApplication app)
    {
        var dbOptions = app.Services.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        if (!dbOptions.AutoMigrate) return;

        using var scope = app.Services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
        try
        {
            var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
            logger.LogInformation("Applying database migrations…");
            await db.Database.MigrateAsync(app.Lifetime.ApplicationStopping);

            if (dbOptions.Seed)
            {
                var seeder = scope.ServiceProvider.GetRequiredService<DbSeeder>();
                await seeder.SeedAsync(app.Configuration["Admin:Email"], app.Lifetime.ApplicationStopping);
            }
        }
        catch (Exception ex) when (app.Environment.IsDevelopment())
        {
            // In Development keep the API (and Swagger) up so the DB can be started afterwards; /health reports Unhealthy.
            logger.LogError(ex, "Database migration/seed failed — is PostgreSQL running? (docker compose up postgres redis)");
        }
    }
}
