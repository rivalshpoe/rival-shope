using Microsoft.Extensions.FileProviders;
using Serilog;
using Store.Api.Extensions;
using Store.Api.Logging;
using Store.Api.Middleware;
using Store.Application;
using Store.Infrastructure;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Serilog: settings come from configuration ("Serilog" section: Console + rolling File).
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .Enrich.WithProperty("Application", "Rival.Api")
        // Structured objects never leak Authorization/Cookie headers, phone numbers, fingerprints, OTPs or tokens.
        .Destructure.With<SensitiveDataDestructuringPolicy>());

    // Graceful shutdown: let in-flight requests (order transactions) finish before the host stops.
    builder.Host.ConfigureHostOptions(o => o.ShutdownTimeout = TimeSpan.FromSeconds(30));

    // Request size limits (spec §12): 64 KB for JSON bodies; the upload action raises its own limit to 6 MB (5 MB image + multipart overhead).
    builder.WebHost.ConfigureKestrel(k =>
    {
        k.AddServerHeader = false;
        k.Limits.MaxRequestBodySize = 64 * 1024;
        k.Limits.MaxRequestHeadersTotalSize = 32 * 1024;
        k.Limits.MaxRequestLineSize = 8 * 1024;
        k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(30);
    });

    builder.Services.AddApplication(builder.Configuration);
    builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
    builder.Services.AddApiServices(builder.Configuration, builder.Environment);

    var app = builder.Build();

    // --- pipeline (order matters) ---
    app.UseForwardedHeaders();
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseMiddleware<SecurityHeadersMiddleware>();
    app.UseMiddleware<GlobalExceptionMiddleware>();
    app.UseMiddleware<RequestLoggingMiddleware>();
    // Unknown routes (404), wrong verbs (405), unsupported media types (415) … get the same JSON envelope as every other error.
    app.UseStatusCodePages(StatusCodeEnvelope.WriteAsync);

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Rival Store API v1");
            c.DocumentTitle = "Rival Store API";
        });
    }
    else
    {
        // Behind Caddy/Nginx the proxy terminates TLS; X-Forwarded-Proto (UseForwardedHeaders above) tells us the scheme.
        // The container HEALTHCHECK calls plain http://localhost:8080/api/v1/health, so health is exempt from the redirect.
        app.UseHsts();
        app.UseWhen(ctx => !ctx.Request.Path.StartsWithSegments("/api/v1/health"), branch => branch.UseHttpsRedirection());
    }

    // Local uploads (Storage:Provider=Local) served from wwwroot/uploads with long-lived caching (GUID names are immutable).
    var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads");
    Directory.CreateDirectory(uploadsPath);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(uploadsPath),
        RequestPath = "/uploads",
        OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable"
    });

    app.UseRouting();
    app.UseCors(Store.Api.Extensions.ServiceCollectionExtensions.FrontendCorsPolicy);
    app.UseMiddleware<RateLimitingMiddleware>();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapHealthEndpoint();

    await app.MigrateAndSeedAsync();

    Log.Information("Rival API starting in {Environment}", app.Environment.EnvironmentName);
    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Rival API terminated unexpectedly");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync();
}

// Exposed for WebApplicationFactory in integration tests.
public partial class Program { }
