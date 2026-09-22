using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Store.Api.Models;
using Store.Application.Common.Exceptions;

namespace Store.Api.Middleware;

/// <summary>
/// Handler for <c>UseStatusCodePages</c>: bodiless 4xx/5xx responses produced by routing or MVC (404 no endpoint,
/// 405 wrong verb, 415 unsupported media type, 406, 413 …) are rewritten into the uniform error envelope.
/// </summary>
public static class StatusCodeEnvelope
{
    public static async Task WriteAsync(StatusCodeContext context)
    {
        var http = context.HttpContext;
        var status = http.Response.StatusCode;
        var (code, message) = status switch
        {
            404 => (ErrorCodes.NotFound, "المسار المطلوب غير موجود."),
            405 => (ErrorCodes.BadRequest, "طريقة الطلب غير مسموحة لهذا المسار."),
            406 => (ErrorCodes.BadRequest, "صيغة الاستجابة المطلوبة غير مدعومة."),
            413 => (ErrorCodes.BadRequest, "حجم الطلب كبير جدًا."),
            415 => (ErrorCodes.BadRequest, "نوع المحتوى غير مدعوم، استخدم application/json."),
            401 => (ErrorCodes.Unauthorized, "غير مصرح. يرجى تسجيل الدخول."),
            403 => (ErrorCodes.Forbidden, "ليس لديك صلاحية للوصول إلى هذا المورد."),
            429 => (ErrorCodes.RateLimited, "تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقًا."),
            >= 500 => (ErrorCodes.InternalError, "حدث خطأ غير متوقع. يرجى المحاولة لاحقًا."),
            _ => (ErrorCodes.BadRequest, "الطلب غير صالح.")
        };

        var payload = new ApiError
        {
            ErrorCode = code,
            Message = message,
            CorrelationId = http.Items[CorrelationIdMiddleware.ItemKey] as string ?? http.TraceIdentifier
        };
        http.Response.ContentType = "application/json; charset=utf-8";
        await http.Response.WriteAsync(JsonSerializer.Serialize(payload, JsonDefaults.Options), http.RequestAborted);
    }
}
