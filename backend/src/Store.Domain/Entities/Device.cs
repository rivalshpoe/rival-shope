using Store.Domain.Common;

namespace Store.Domain.Entities;

public class Device : AuditableEntity
{
    /// <summary>Number of orders marked Fake that triggers an automatic block.</summary>
    public const int AutoBlockThreshold = 5;

    /// <summary>HMAC-SHA256 (hex) of the raw fingerprint — used for lookups (unique).</summary>
    public string DeviceHash { get; set; } = string.Empty;
    /// <summary>AES-256-GCM ciphertext of the raw fingerprint (defence in depth, never exposed).</summary>
    public byte[] DeviceHashEncrypted { get; set; } = Array.Empty<byte>();

    public int FakeOrderCount { get; set; }
    public int TotalOrders { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime? BlockedAt { get; set; }
    public string? BlockedReason { get; set; }
    public DateTime? LastOrderAt { get; set; }

    public ICollection<Order> Orders { get; set; } = new List<Order>();

    /// <summary>Increments the fake counter and auto-blocks at <see cref="AutoBlockThreshold"/>. Returns true if the device got blocked by this call.</summary>
    public bool RegisterFakeOrder(DateTime utcNow)
    {
        FakeOrderCount++;
        UpdatedAt = utcNow;
        if (!IsBlocked && FakeOrderCount >= AutoBlockThreshold)
        {
            Block(utcNow, $"حظر تلقائي: بلوغ {AutoBlockThreshold} طلبات وهمية");
            return true;
        }
        return false;
    }

    public void Block(DateTime utcNow, string? reason)
    {
        IsBlocked = true;
        BlockedAt = utcNow;
        BlockedReason = reason;
        UpdatedAt = utcNow;
    }

    public void Unblock(DateTime utcNow)
    {
        IsBlocked = false;
        BlockedAt = null;
        BlockedReason = null;
        UpdatedAt = utcNow;
    }
}
