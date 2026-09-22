using Store.Domain.Common;

namespace Store.Domain.Entities;

public class DeliveryZone : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public decimal? ExtraFee { get; set; }
    public bool IsActive { get; set; } = true;
}
