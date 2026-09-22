namespace Store.Application.Common.Exceptions;

/// <summary>Canonical error codes shared with the frontend contract.</summary>
public static class ErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string NotFound = "NOT_FOUND";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Forbidden = "FORBIDDEN";
    public const string Conflict = "CONFLICT";
    public const string OutOfStock = "OUT_OF_STOCK";
    public const string InvoiceLocked = "INVOICE_LOCKED";
    public const string DuplicateRequest = "DUPLICATE_REQUEST";
    public const string RateLimited = "RATE_LIMITED";
    public const string DeviceBlocked = "DEVICE_BLOCKED";
    public const string BadRequest = "BAD_REQUEST";
    public const string SearchTooLong = "SEARCH_TOO_LONG";
    public const string InternalError = "INTERNAL_ERROR";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
    public const string EmailFailed = "EMAIL_FAILED";
}

/// <summary>Base class for all expected application errors. Message is user-safe Arabic text.</summary>
public abstract class AppException : Exception
{
    public string ErrorCode { get; }
    public int StatusCode { get; }
    public IReadOnlyDictionary<string, string>? FieldErrors { get; protected init; }

    protected AppException(int statusCode, string errorCode, string message) : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}

public sealed class NotFoundException : AppException
{
    public NotFoundException(string message = "المورد المطلوب غير موجود.")
        : base(404, ErrorCodes.NotFound, message) { }

    public NotFoundException(string entity, object key)
        : base(404, ErrorCodes.NotFound, $"{entity} غير موجود ({key}).") { }
}

public sealed class ValidationException : AppException
{
    public ValidationException(IDictionary<string, string> fieldErrors, string message = "بعض الحقول غير صالحة، يرجى المراجعة.")
        : base(422, ErrorCodes.ValidationError, message)
    {
        FieldErrors = new Dictionary<string, string>(fieldErrors);
    }

    public ValidationException(string field, string error)
        : this(new Dictionary<string, string> { [field] = error }) { }
}

public sealed class ConflictException : AppException
{
    public ConflictException(string message, string errorCode = ErrorCodes.Conflict)
        : base(409, errorCode, message) { }
}

public sealed class ForbiddenException : AppException
{
    public ForbiddenException(string message = "ليس لديك صلاحية لتنفيذ هذا الإجراء.")
        : base(403, ErrorCodes.Forbidden, message) { }
}

public sealed class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "غير مصرح. يرجى تسجيل الدخول.")
        : base(401, ErrorCodes.Unauthorized, message) { }
}

public sealed class RateLimitedException : AppException
{
    public int? RetryAfterSeconds { get; }

    public RateLimitedException(string message = "تم تجاوز الحد المسموح من الطلبات، حاول لاحقًا.", string errorCode = ErrorCodes.RateLimited, int? retryAfterSeconds = null)
        : base(429, errorCode, message)
    {
        RetryAfterSeconds = retryAfterSeconds;
    }
}

public sealed class BadRequestException : AppException
{
    public BadRequestException(string message, string errorCode = ErrorCodes.BadRequest)
        : base(400, errorCode, message) { }
}

public sealed class ExternalServiceException : AppException
{
    public ExternalServiceException(string message, string errorCode = ErrorCodes.EmailFailed, int statusCode = 502)
        : base(statusCode, errorCode, message) { }
}
