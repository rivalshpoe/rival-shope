using Store.Domain.Common;
using Store.Domain.Enums;

namespace Store.Domain.Entities;

/// <summary>Append-only inventory movement record. Never updated or deleted.</summary>
public class InventoryLog : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid? ProductSizeId { get; set; }
    public ProductSize? ProductSize { get; set; }
    public InventoryChangeType ChangeType { get; set; }
    /// <summary>Signed delta: negative for Sale, positive for Restock/Return, zero for Depleted marker.</summary>
    public int QuantityChanged { get; set; }
    public int StockAfter { get; set; }
    public string? Note { get; set; }
    public Guid? OrderId { get; set; }
}
