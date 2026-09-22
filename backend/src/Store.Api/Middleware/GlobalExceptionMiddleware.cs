using System.Net.Sockets;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Store.Api.Models;
using Store.Application.Common.Exceptions;
using Store.Domain.Exceptions;

namespace Store.Api.Middleware;

/// <summary>
/// Single place that turns every exception into the uniform error envelope with Arabic user-safe messages.
/// Internal details (stack traces, SQL, connection strings) are only included in Development — outside Development the
/// body contains exactly { success, errorCode, message, correlationId, fieldErrors? } and nothing derived from the exception text.
/// </summary>
public sealed class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IHostEnvironment env)
    {
        _next = next; _logger = logger; _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client went away — nothing to send.
            _logger.LogDebug("Request aborted by client {Path}", context.Request.Path);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception ex)
    {
        var correlationId = context.Items[CorrelationIdMiddleware.ItemKey] as string ?? context.TraceIdentifier;
        var (status, code, message, fieldErrors, retryAfter) = Map(ex);

        // Path only — never the query string (search text) or any body/header content.
        if (status >= 500)
            _logger.LogError(ex, "Unhandled exception {ErrorCode} ({Status}) for {Method} {Path}", code, status, context.Request.Method, context.Request.Path);
        else if (ex is AppException or DomainException or FluentValidation.ValidationException)
            _logger.LogInformation("Handled {ErrorCode} ({Status}) for {Method} {Path}", code, status, context.Request.Method, context.Request.Path);
        else
            _logger.LogWarning(ex, "Handled {ErrorCode} ({Status}) for {Method} {Path}", code, status, context.Request.Method, context.Request.Path);

        if (context.Response.HasStarted)
        {
            _logger.LogWarning("Response already started; cannot write error envelope");
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json; charset=utf-8";
        if (retryAfter is > 0) context.Response.Headers.RetryAfter = retryAfter.Value.ToString();

        var payload = new ApiError
        {
            ErrorCode = code,
            Message = message,
            CorrelationId = correlationId,
            FieldErrors = fieldErrors,
            Details = _env.IsDevelopment() ? ex.ToString() : null
        };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonDefaults.Options), context.RequestAborted);
    }

    private static (int Status, string Code, string Message, IReadOnlyDictionary<string, string>? FieldErrors, int? RetryAfter) Map(Exception ex) => ex switch
    {
        RateLimitedException rl => (429, rl.ErrorCode, rl.Message, null, rl.RetryAfterSeconds),
        AppException app => (app.StatusCode, app.ErrorCode, app.Message, app.FieldErrors, null),
        DomainException d => (409, d.ErrorCode, d.Message, null, null),
        FluentValidation.ValidationException fv => (422, ErrorCodes.ValidationError, "بعض الحقول غير صالحة، يرجى المراجعة.",
            fv.Errors.GroupBy(e => e.PropertyName).ToDictionary(g => g.Key, g => g.First().ErrorMessage), null),
        BadHttpRequestException bad => (bad.StatusCode == 413 ? 413 : 400, ErrorCodes.BadRequest, bad.StatusCode == 413 ? "حجم الطلب كبير جدًا." : "الطلب غير صالح.", null, null),
        JsonException => (400, ErrorCodes.BadRequest, "صيغة البيانات المرسلة غير صالحة.", null, null),
        DbUpdateConcurrencyException => (409, ErrorCodes.Conflict, "تم تعديل البيانات من جهة أخرى، يرجى إعادة المحاولة.", null, null),
        DbUpdateException dbu when dbu.InnerException is PostgresException { SqlState: "23505" } => (409, ErrorCodes.Conflict, "القيمة مستخدمة مسبقًا.", null, null),
        DbUpdateException dbu when dbu.InnerException is PostgresException { SqlState: "23514" } => (409, ErrorCodes.Conflict, "البيانات تخالف قيود النظام (مثل مخزون سالب).", null, null),
        DbUpdateException dbu when dbu.InnerException is PostgresException { SqlState: "23503" } => (409, ErrorCodes.Conflict, "لا يمكن تنفيذ العملية لوجود بيانات مرتبطة.", null, null),
        DbUpdateException dbu when IsConnectionFailure(dbu.InnerException) => DbUnavailable,
        // Server-side SQL errors (PostgresException) that are not transient are bugs ⇒ 500; everything else from Npgsql is connection-level ⇒ 503.
        PostgresException { IsTransient: true } => DbUnavailable,
        PostgresException => (500, ErrorCodes.InternalError, "حدث خطأ غير متوقع. يرجى المحاولة لاحقًا.", null, null),
        NpgsqlException => DbUnavailable,
        TimeoutException => (504, ErrorCodes.ServiceUnavailable, "انتهت مهلة الطلب، حاول لاحقًا.", null, 5),
        // Cancelled by a timeout (not by the client — that case is handled in InvokeAsync).
        OperationCanceledException => (504, ErrorCodes.ServiceUnavailable, "انتهت مهلة الطلب، حاول لاحقًا.", null, 5),
        HttpRequestException => (502, ErrorCodes.EmailFailed, "تعذّر الاتصال بخدمة خارجية، حاول لاحقًا.", null, null),
        _ => (500, ErrorCodes.InternalError, "حدث خطأ غير متوقع. يرجى المحاولة لاحقًا.", null, null)
    };

    private static readonly (int, string, string, IReadOnlyDictionary<string, string>?, int?) DbUnavailable =
        (503, ErrorCodes.ServiceUnavailable, "قاعدة البيانات غير متاحة مؤقتًا، حاول لاحقًا.", null, 5);

    private static bool IsConnectionFailure(Exception? ex) =>
        ex is NpgsqlException and not PostgresException || ex is SocketException or TimeoutException || ex?.InnerException is SocketException;
}

/// <summary>Shared JSON settings for responses written outside MVC (middleware, health checks).</summary>
public static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };
}
