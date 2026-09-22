using Store.Domain.Common;
using Store.Domain.Enums;
using Store.Domain.Exceptions;
using Store.Domain.Rules;

namespace Store.Domain.Entities;

public class Order : AuditableEntity
{
    public const int EditableWindowDays = 30;

    public string InvoiceNumber { get; set; } = string.Empty;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;

    public bool NeedsDelivery { get; set; }
    public Guid? DeliveryZoneId { get; set; }
    public DeliveryZone? DeliveryZone { get; set; }
    public string? Address { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string WhatsAppCountryCode { get; set; } = string.Empty;

    public decimal Subtotal { get; set; }
    public Guid? DiscountCodeId { get; set; }
    public DiscountCode? DiscountCode { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }

    public Guid DeviceId { get; set; }
    public Device Device { get; set; } = null!;

    public bool IsCollected { get; set; }
    public DateTime? CollectedAt { get; set; }
    public DateTime EditableUntil { get; set; }
    public string? IdempotencyKey { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();

    public bool CanEdit(DateTime utcNow) => utcNow <= EditableUntil;

    /// <summary>
    /// Applies a status transition enforcing the 30-day edit window and the allowed transition graph.
    /// Returns true when stock must be returned to inventory (first time the order leaves a stock-holding state).
    /// </summary>
    public bool ChangeStatus(OrderStatus newStatus, DateTime utcNow)
    {
        if (!CanEdit(utcNow))
            throw new DomainException("انتهت نافذة تعديل هذه الفاتورة (30 يومًا).", "INVOICE_LOCKED");

        if (!OrderStatusRules.CanTransition(Status, newStatus))
            throw new DomainException($"لا يمكن تغيير حالة الطلب من {Status} إلى {newStatus}.", "CONFLICT");

        var returnsStock = OrderStatusRules.ReturnsStock(Status, newStatus);
        Status = newStatus;
        UpdatedAt = utcNow;
        return returnsStock;
    }
}

public class OrderItem : AuditableEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid? ProductSizeId { get; set; }
    public ProductSize? ProductSize { get; set; }
    public Guid? ProductColorId { get; set; }
    public ProductColor? ProductColor { get; set; }

    public string ProductTitleSnapshot { get; set; } = string.Empty;
    public string? ProductImageUrlSnapshot { get; set; }
    public string? SizeLabelSnapshot { get; set; }
    public string? ColorNameSnapshot { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal => UnitPrice * Quantity;
}
