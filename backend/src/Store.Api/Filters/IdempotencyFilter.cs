using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using Store.Api.Services;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;

namespace Store.Api.Filters;

/// <summary>Marks an action as idempotent via the <c>Idempotency-Key</c> header (resolved through DI).</summary>
public sealed class IdempotentAttribute : ServiceFilterAttribute
{
    public IdempotentAttribute() : base(typeof(IdempotencyFilter)) { }
}

/// <summary>
/// Idempotency-Key handling for POST /orders (spec §12):
///  • missing key ⇒ 400 BAD_REQUEST
///  • same key while the first request is still running ⇒ 409 DUPLICATE_REQUEST
///  • same key after completion (24h) ⇒ the original response is replayed byte-for-byte
/// Keys are scoped by device fingerprint (or IP) so two clients cannot collide.
/// When Redis is unavailable the in-memory store takes over (same semantics, per instance); the order handler additionally
/// de-duplicates via the unique IdempotencyKey column, so a duplicate order is impossible even across instances.
/// </summary>
public sealed class IdempotencyFilter : IAsyncActionFilter
{
    public const string HeaderName = "Idempotency-Key";
    private static readonly TimeSpan ResponseTtl = TimeSpan.FromHours(24);
    private static readonly TimeSpan InFlightTtl = TimeSpan.FromSeconds(60);

    private readonly IIdempotencyStore _store;
    private readonly JsonSerializerOptions _json;
    private readonly ILogger<IdempotencyFilter> _logger;

    public IdempotencyFilter(IIdempotencyStore store, IOptions<JsonOptions> jsonOptions, ILogger<IdempotencyFilter> logger)
    {
        _store = store;
        _json = jsonOptions.Value.JsonSerializerOptions;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        var key = http.Request.Headers[HeaderName].FirstOrDefault()?.Trim();
        if (string.IsNullOrWhiteSpace(key))
            throw new BadRequestException("الترويسة Idempotency-Key مطلوبة.");
        if (key.Length > 128)
            throw new BadRequestException("Idempotency-Key طويل جدًا.");

        var scope = http.Request.Headers[HttpRequestContext.FingerprintHeader].FirstOrDefault()
                    ?? http.Connection.RemoteIpAddress?.ToString() ?? "anon";
        var storeKey = Hash($"{http.Request.Path}|{scope}|{key}");

        var begin = await _store.BeginAsync(storeKey, InFlightTtl, http.RequestAborted);
        switch (begin.State)
        {
            case IdempotencyState.Completed when begin.Cached is not null:
                _logger.LogInformation("Idempotent replay for {Path}", http.Request.Path);
                context.Result = new ContentResult
                {
                    StatusCode = begin.Cached.StatusCode,
                    ContentType = begin.Cached.ContentType,
                    Content = begin.Cached.Body
                };
                http.Response.Headers["Idempotent-Replayed"] = "true";
                return;

            case IdempotencyState.InFlight:
                throw new ConflictException("هناك طلب مطابق قيد التنفيذ حاليًا، يرجى الانتظار.", ErrorCodes.DuplicateRequest);
        }

        var owned = begin.State == IdempotencyState.Acquired;
        ActionExecutedContext executed;
        try
        {
            executed = await next();
        }
        catch
        {
            if (owned) await _store.ReleaseAsync(storeKey, CancellationToken.None);
            throw;
        }

        if (!owned) return;

        if (executed.Exception is not null && !executed.ExceptionHandled)
        {
            await _store.ReleaseAsync(storeKey, CancellationToken.None);
            return;
        }

        if (executed.Result is ObjectResult { Value: not null } objectResult)
        {
            var status = objectResult.StatusCode ?? StatusCodes.Status200OK;
            if (status is >= 200 and < 300)
            {
                var body = JsonSerializer.Serialize(objectResult.Value, objectResult.Value.GetType(), _json);
                await _store.CompleteAsync(storeKey, new IdempotentResponse(status, "application/json; charset=utf-8", body), ResponseTtl, CancellationToken.None);
                return;
            }
        }

        await _store.ReleaseAsync(storeKey, CancellationToken.None);
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
}
