using System.Diagnostics;

namespace Store.Api.Middleware;

/// <summary>
/// One structured log line per request (method, path, status, elapsed, IP). Never logs headers, bodies, tokens, cookies or phone numbers.
/// </summary>
public sealed class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next; _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/api/v1/health"))
        {
            await _next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            var status = context.Response.StatusCode;
            var level = status >= 500 ? LogLevel.Error : status >= 400 ? LogLevel.Warning : LogLevel.Information;
            _logger.Log(level, "HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs}ms from {Ip}",
                context.Request.Method,
                SafePath(context.Request.Path),
                status,
                sw.ElapsedMilliseconds,
                context.Connection.RemoteIpAddress?.ToString() ?? "-");
        }
    }

    // Query strings may contain search text; path only is enough for operations.
    private static string SafePath(PathString path) => path.HasValue ? path.Value! : "/";
}
