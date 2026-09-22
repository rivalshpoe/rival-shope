using Store.Domain.Entities;
using Store.Domain.Enums;

namespace Store.Application.Features.Orders;

public sealed record CreateOrderItemInput(Guid ProductId, Guid? SizeId, Guid? ColorId, int Quantity);

public sealed record CreateOrderInput(
    IReadOnlyList<CreateOrderItemInput> Items,
    bool NeedsDelivery,
    Guid? DeliveryZoneId,
    string? Address,
    string CustomerName,
    string PhoneNumber,
    string WhatsAppCountryCode,
    string? DiscountCode);

public sealed record CreateOrderResultDto(string InvoiceNumber, decimal Total, decimal DiscountAmount, OrderStatus Status);

public sealed record AdminOrderRowDto(
    Guid Id, string InvoiceNumber, string CustomerName, string PhoneNumber, string WhatsAppCountryCode,
    decimal Total, OrderStatus Status, int ItemCount, bool IsCollected, DateTime CreatedAt);

public sealed record AdminOrderDeviceDto(Guid Id, bool IsBlocked, int FakeOrderCount);
public sealed record AdminOrderItemDto(Guid ProductId, string ProductTitle, string? ProductImageUrl, string? SizeLabel, string? ColorName, int Quantity, decimal UnitPrice, decimal LineTotal);

public sealed record AdminOrderDetailsDto(
    Guid Id,
    string InvoiceNumber,
    OrderStatus Status,
    string CustomerName,
    string PhoneNumber,
    string WhatsAppCountryCode,
    string WhatsAppNumber,
    string? Address,
    bool NeedsDelivery,
    string? DeliveryZoneName,
    decimal Subtotal,
    string? DiscountCode,
    decimal DiscountAmount,
    decimal DeliveryFee,
    decimal Total,
    bool IsCollected,
    DateTime? CollectedAt,
    DateTime CreatedAt,
    DateTime EditableUntil,
    bool CanEdit,
    AdminOrderDeviceDto Device,
    IReadOnlyList<AdminOrderItemDto> Items);

public sealed record CollectResultDto(int CollectedCount, decimal CollectedAmount, IReadOnlyList<string> NotFound);

internal static class OrderMapping
{
    public static string WhatsAppNumber(string countryCode, string phone)
    {
        var cc = new string(countryCode.Where(char.IsDigit).ToArray());
        var p = new string(phone.Where(char.IsDigit).ToArray()).TrimStart('0');
        return cc + p;
    }

    public static AdminOrderDetailsDto ToDetails(Order o, DateTime now) => new(
        o.Id, o.InvoiceNumber, o.Status, o.CustomerName, o.PhoneNumber, o.WhatsAppCountryCode,
        WhatsAppNumber(o.WhatsAppCountryCode, o.PhoneNumber),
        o.Address, o.NeedsDelivery, o.DeliveryZone?.Name,
        o.Subtotal, o.DiscountCode?.Code, o.DiscountAmount, o.DeliveryFee, o.Total,
        o.IsCollected, o.CollectedAt, o.CreatedAt, o.EditableUntil, o.CanEdit(now),
        new AdminOrderDeviceDto(o.DeviceId, o.Device?.IsBlocked ?? false, o.Device?.FakeOrderCount ?? 0),
        o.Items.OrderBy(i => i.CreatedAt).Select(i => new AdminOrderItemDto(
            i.ProductId, i.ProductTitleSnapshot, i.ProductImageUrlSnapshot, i.SizeLabelSnapshot, i.ColorNameSnapshot,
            i.Quantity, i.UnitPrice, i.UnitPrice * i.Quantity)).ToList());
}
