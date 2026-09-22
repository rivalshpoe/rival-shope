using Store.Domain.Common;

namespace Store.Domain.Entities;

public class AdminUser : AuditableEntity
{
    public string Email { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}

public class AdminOtpCode : AuditableEntity
{
    public const int MaxAttempts = 5;
    public const int ExpiryMinutes = 5;
    public const int CooldownSeconds = 60;

    public string Email { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public int AttemptsCount { get; set; }
    public bool IsUsed { get; set; }

    public bool IsValidAt(DateTime utcNow) => !IsUsed && ExpiresAt > utcNow && AttemptsCount < MaxAttempts;

    /// <summary>Registers a failed attempt; invalidates the code once the max is reached. Returns true when invalidated.</summary>
    public bool RegisterFailedAttempt()
    {
        AttemptsCount++;
        if (AttemptsCount >= MaxAttempts)
        {
            IsUsed = true;
            return true;
        }
        return false;
    }
}

public class RefreshToken : AuditableEntity
{
    public Guid AdminUserId { get; set; }
    public AdminUser AdminUser { get; set; } = null!;
    /// <summary>SHA-256 (hex) of the opaque token — raw token is never stored.</summary>
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? ReplacedByTokenHash { get; set; }
    public string? CreatedByIp { get; set; }

    public bool IsActive(DateTime utcNow) => RevokedAt is null && ExpiresAt > utcNow;
}

public class AdminAuditLog : AuditableEntity
{
    public string AdminEmail { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}
