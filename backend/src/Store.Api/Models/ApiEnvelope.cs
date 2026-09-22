namespace Store.Api.Models;

/// <summary>Uniform success envelope: <c>{ success: true, data }</c>.</summary>
public sealed class ApiResponse<T>
{
    public bool Success { get; init; } = true;
    public T? Data { get; init; }

    public static ApiResponse<T> Ok(T data) => new() { Data = data };
}

/// <summary>Uniform error envelope: <c>{ success: false, errorCode, message, correlationId, fieldErrors? }</c>.</summary>
public sealed class ApiError
{
    public bool Success { get; init; } = false;
    public string ErrorCode { get; init; } = "INTERNAL_ERROR";
    public string Message { get; init; } = string.Empty;
    public string CorrelationId { get; init; } = string.Empty;
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyDictionary<string, string>? FieldErrors { get; init; }
    /// <summary>Only populated in Development.</summary>
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? Details { get; init; }
}
