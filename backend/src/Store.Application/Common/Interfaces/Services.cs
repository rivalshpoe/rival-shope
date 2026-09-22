namespace Store.Application.Common.Interfaces;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}

/// <summary>Cache-Aside abstraction. Implementations MUST be fail-safe: when the distributed cache is unavailable, fall back to memory or behave as a no-op.</summary>
public interface ICacheService
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default);
    Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default);
    Task<T> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<CancellationToken, Task<T>> factory, CancellationToken ct = default);
    Task RemoveAsync(string key, CancellationToken ct = default);
    Task RemoveByPrefixAsync(string prefix, CancellationToken ct = default);
}

/// <summary>Sliding-window rate limiter (Redis with in-memory fail-over). Limits are always enforced.</summary>
public interface IRateLimiter
{
    Task<RateLimitResult> HitAsync(string key, int limit, TimeSpan window, CancellationToken ct = default);
}

public sealed record RateLimitResult(bool Allowed, int Count, int Limit, int RetryAfterSeconds);

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);
}

public interface IFileStorage
{
    /// <summary>Stores the content under <paramref name="fileName"/> and returns the public URL.</summary>
    Task<string> SaveAsync(Stream content, string fileName, string contentType, CancellationToken ct = default);
    Task DeleteAsync(string url, CancellationToken ct = default);
}

public sealed record ProcessedImage(byte[] Main, byte[] Thumbnail, string ContentType, string Extension);

public interface IImageProcessor
{
    /// <summary>Validates magic bytes / size and converts to WebP (main max 1600px, thumbnail 400px).</summary>
    Task<ProcessedImage> ProcessAsync(Stream input, CancellationToken ct = default);
    bool IsSupportedImage(ReadOnlySpan<byte> header);
}

public interface ICurrentAdminService
{
    bool IsAuthenticated { get; }
    Guid? AdminId { get; }
    string? Email { get; }
}

/// <summary>Per-request client info (IP, device fingerprint header, correlation id).</summary>
public interface IRequestContext
{
    string? IpAddress { get; }
    string? DeviceFingerprint { get; }
    string CorrelationId { get; }
    string? UserAgent { get; }
}

public interface IDeviceFingerprintService
{
    /// <summary>HMAC-SHA256 hex digest of the raw fingerprint (deterministic lookup key).</summary>
    string ComputeHash(string rawFingerprint);
    /// <summary>AES-256-GCM encryption of the raw fingerprint for at-rest protection.</summary>
    byte[] Encrypt(string rawFingerprint);
    string Mask(string hash);
}

public sealed record AccessTokenResult(string Token, int ExpiresInSeconds);

public interface IJwtTokenGenerator
{
    AccessTokenResult GenerateAccessToken(Guid adminId, string email);
    /// <summary>Generates an opaque refresh token and its SHA-256 hash (hex).</summary>
    (string RawToken, string TokenHash) GenerateRefreshToken();
    string HashRefreshToken(string rawToken);
    int RefreshTokenDays { get; }
}

public interface IOtpHasher
{
    string Hash(string code);
    bool Verify(string code, string hash);
}

public interface IInvoiceNumberGenerator
{
    /// <summary>Must be called inside the order transaction; safe under concurrency.</summary>
    Task<string> NextAsync(DateTime utcNow, CancellationToken ct = default);
}

public sealed record IdempotentResponse(int StatusCode, string ContentType, string Body);

/// <summary>Store for <c>Idempotency-Key</c> replays (Redis with in-memory fail-over). <see cref="IdempotencyState.Unavailable"/> is only returned by the no-op test double.</summary>
public interface IIdempotencyStore
{
    /// <summary>Returns Completed (cached response), InFlight, or Acquired (caller owns the key and must Complete/Release).</summary>
    Task<IdempotencyBeginResult> BeginAsync(string key, TimeSpan inFlightTtl, CancellationToken ct = default);
    Task CompleteAsync(string key, IdempotentResponse response, TimeSpan ttl, CancellationToken ct = default);
    Task ReleaseAsync(string key, CancellationToken ct = default);
}

public enum IdempotencyState { Acquired, InFlight, Completed, Unavailable }
public sealed record IdempotencyBeginResult(IdempotencyState State, IdempotentResponse? Cached);

/// <summary>The single admin identity fixed in configuration (<c>Admin:Email</c>).</summary>
public interface IAdminSettings
{
    /// <summary>Lower-cased, trimmed admin e-mail.</summary>
    string Email { get; }
}

public interface IAuditLogger
{
    /// <summary>Adds an audit entry to the current unit of work (persisted with the next SaveChanges).</summary>
    void Log(string action, string entityType, Guid? entityId = null, string? details = null, string? adminEmailOverride = null);
}
