using Store.Domain.Common;

namespace Store.Domain.Entities;

public class DiscountCode : AuditableEntity
{
    /// <summary>Always stored upper-case.</summary>
    public string Code { get; set; } = string.Empty;
    public int PercentageOff { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public bool IsActive { get; set; } = true;
    public int UsageCount { get; set; }

    public bool IsCurrentlyValid(DateTime utcNow) =>
        IsActive && !IsDeleted && StartAt <= utcNow && EndAt >= utcNow;
}
