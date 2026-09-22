using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Store.Api.Models;
using Store.Api.Services;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;

namespace Store.Api.Middleware;

/// <summary>
/// Sliding-window limits (spec §7/§12). Backed by Redis when available, otherwise by the in-memory limiter
/// (fail-over, never fail-open — limits stay enforced per instance when Redis is down):
///  • POST /api/v1/orders → 3/hour per device fingerprint (IP-keyed with the same limit when the header is missing) + 30/hour per IP.
///  • GET  /api/v1/search → 30/minute per IP.
///  • POST /api/v1/admin/auth/request-otp → 10/hour per IP (the per-e-mail 3/hour limit lives in the handler).
///  • POST /api/v1/admin/auth/verify-otp → 30/hour per IP.
/// </summary>
public sealed class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IRateLimiter _limiter;
    private readonly ILogger<RateLimitingMiddleware> _logger;

    private static readonly TimeSpan Hour = TimeSpan.FromHours(1);
    private static readonly TimeSpan Minute = TimeSpan.FromMinutes(1);

    public RateLimitingMiddleware(RequestDelegate next, IRateLimiter limiter, ILogger<RateLimitingMiddleware> logger)
    {
        _next = next; _limiter = limiter; _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        var method = context.Request.Method;
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        RateLimitResult? blocked = null;

        if (HttpMethods.IsPost(method) && path.Equals("/api/v1/orders", StringComparison.OrdinalIgnoreCase))
        {
            var fingerprint = context.Request.Headers[HttpRequestContext.FingerprintHeader].FirstOrDefault();
            var deviceKey = string.IsNullOrWhiteSpace(fingerprint)
                ? $"orders:ip-only:{ip}"                       // no fingerprint ⇒ strict IP-only bucket
                : $"orders:fp:{Hash(fingerprint.Trim())}";
            blocked = await FirstBlocked(context,
                (deviceKey, 3, Hour),
                ($"orders:ip:{ip}", 30, Hour));
        }
        else if (HttpMethods.IsGet(method) && path.Equals("/api/v1/search", StringComparison.OrdinalIgnoreCase))
        {
            blocked = await FirstBlocked(context, ($"search:ip:{ip}", 30, Minute));
        }
        else if (HttpMethods.IsPost(method) && path.Equals("/api/v1/admin/auth/request-otp", StringComparison.OrdinalIgnoreCase))
        {
            blocked = await FirstBlocked(context, ($"otp:request:ip:{ip}", 10, Hour));
        }
        else if (HttpMethods.IsPost(method) && path.Equals("/api/v1/admin/auth/verify-otp", StringComparison.OrdinalIgnoreCase))
        {
            blocked = await FirstBlocked(context, ($"otp:verify:ip:{ip}", 30, Hour));
        }

        if (blocked is not null)
        {
            await WriteTooManyRequests(context, blocked);
            return;
        }

        await _next(context);
    }

    private async Task<RateLimitResult?> FirstBlocked(HttpContext context, params (string Key, int Limit, TimeSpan Window)[] rules)
    {
        foreach (var (key, limit, window) in rules)
        {
            var result = await _limiter.HitAsync(key, limit, window, context.RequestAborted);
            if (!result.Allowed)
            {
                _logger.LogWarning("Rate limit exceeded for {RuleKey} ({Count}/{Limit})", Redact(key), result.Count, result.Limit);
                return result;
            }
        }
        return null;
    }

    private static async Task WriteTooManyRequests(HttpContext context, RateLimitResult result)
    {
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.ContentType = "application/json; charset=utf-8";
        if (result.RetryAfterSeconds > 0) context.Response.Headers.RetryAfter = result.RetryAfterSeconds.ToString();
        var payload = new ApiError
        {
            ErrorCode = ErrorCodes.RateLimited,
            Message = "تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقًا.",
            CorrelationId = context.Items[CorrelationIdMiddleware.ItemKey] as string ?? context.TraceIdentifier
        };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonDefaults.Options), context.RequestAborted);
    }

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)))[..32].ToLowerInvariant();

    // Keys may embed IPs — keep only the rule prefix in logs.
    private static string Redact(string key) => key.Split(':')[0] + ":*";
}
