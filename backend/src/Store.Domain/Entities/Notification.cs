using Store.Domain.Common;
using Store.Domain.Enums;

namespace Store.Domain.Entities;

public class Notification : AuditableEntity
{
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public Guid? RelatedOrderId { get; set; }
    public Guid? RelatedProductId { get; set; }
    public bool IsResolved { get; set; }
    public DateTime? ResolvedAt { get; set; }

    public void Resolve(DateTime utcNow)
    {
        if (IsResolved) return;
        IsResolved = true;
        ResolvedAt = utcNow;
        UpdatedAt = utcNow;
    }
}
