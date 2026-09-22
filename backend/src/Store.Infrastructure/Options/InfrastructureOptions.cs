namespace Store.Infrastructure.Options;

public sealed class JwtOptions
{
    public const string Section = "Jwt";
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "rival-api";
    public string Audience { get; set; } = "rival-admin";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
}

public sealed class SecurityOptions
{
    public const string Section = "Security";
    /// <summary>Key for HMAC-SHA256 of device fingerprints (any string ≥ 32 chars, or base64).</summary>
    public string DeviceHmacKey { get; set; } = string.Empty;
    /// <summary>Base64 32-byte key for AES-256-GCM (or any string — hashed to 32 bytes).</summary>
    public string AesKey { get; set; } = string.Empty;
}

public sealed class ResendOptions
{
    public const string Section = "Resend";
    public string ApiKey { get; set; } = string.Empty;
    public string From { get; set; } = "Rival <no-reply@example.com>";
    public string BaseUrl { get; set; } = "https://api.resend.com/";
}

public sealed class StorageOptions
{
    public const string Section = "Storage";
    /// <summary>"Local" or "Spaces".</summary>
    public string Provider { get; set; } = "Local";
    /// <summary>Public base URL for local uploads (e.g. https://api.example.com). Empty ⇒ relative "/uploads/...".</summary>
    public string LocalPublicBaseUrl { get; set; } = string.Empty;
    public string LocalRootPath { get; set; } = "wwwroot/uploads";
}

public sealed class SpacesOptions
{
    public const string Section = "Spaces";
    public string Endpoint { get; set; } = "https://fra1.digitaloceanspaces.com";
    public string Region { get; set; } = "fra1";
    public string Bucket { get; set; } = string.Empty;
    public string AccessKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    /// <summary>CDN base URL, e.g. https://cdn.example.com (no trailing slash).</summary>
    public string CdnBaseUrl { get; set; } = string.Empty;
    public string Folder { get; set; } = "uploads";
}

public sealed class RedisOptions
{
    public const string Section = "Redis";
    public string ConnectionString { get; set; } = "localhost:6379";
    public string InstanceName { get; set; } = "rival:";
}

public sealed class DatabaseOptions
{
    public const string Section = "Database";
    public bool AutoMigrate { get; set; }
    public bool Seed { get; set; } = true;
}

public sealed class AdminOptions
{
    public const string Section = "Admin";
    /// <summary>The single admin e-mail allowed to request an OTP (seeded into AdminUsers).</summary>
    public string Email { get; set; } = "rivalshpoe@gmail.com";
}

public sealed class EmailOptions
{
    public const string Section = "Email";
    /// <summary>"Resend" or "Development" (logs the OTP instead of sending).</summary>
    public string Provider { get; set; } = "Development";
}
