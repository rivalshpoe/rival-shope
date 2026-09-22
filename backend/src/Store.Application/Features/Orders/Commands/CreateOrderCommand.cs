using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using ValidationException = Store.Application.Common.Exceptions.ValidationException;
using Store.Application.Common.Interfaces;
using Store.Application.Features.Inventory;
using Store.Application.Features.Notifications;
using Store.Domain.Entities;
using Store.Domain.Enums;
using Store.Domain.Rules;

namespace Store.Application.Features.Orders.Commands;

/// <summary>
/// Guest checkout. Device fingerprint + idempotency key come from headers (resolved by the API layer into <see cref="IRequestContext"/>).
/// </summary>
public sealed record CreateOrderCommand(CreateOrderInput Input, string? IdempotencyKey) : IRequest<CreateOrderResultDto>;

public sealed class CreateOrderCommandValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderCommandValidator()
    {
        RuleFor(x => x.Input.Items).NotEmpty().WithMessage("السلة فارغة.")
            .Must(i => i is null || i.Count <= 30).WithMessage("عدد العناصر كبير جدًا.");
        RuleForEach(x => x.Input.Items).ChildRules(i =>
        {
            i.RuleFor(z => z.ProductId).NotEmpty().WithMessage("المنتج مطلوب.");
            i.RuleFor(z => z.Quantity).InclusiveBetween(1, 50).WithMessage("الكمية يجب أن تكون بين 1 و50.");
        });
        RuleFor(x => x.Input.CustomerName).NotEmpty().WithMessage("الاسم مطلوب.").MinimumLength(2).WithMessage("الاسم قصير جدًا.").MaximumLength(100).WithMessage("الاسم طويل جدًا.");
        RuleFor(x => x.Input.PhoneNumber).NotEmpty().WithMessage("رقم الهاتف مطلوب.")
            .Matches(@"^\d{7,12}$").WithMessage("رقم الهاتف غير صحيح.");
        RuleFor(x => x.Input.WhatsAppCountryCode).NotEmpty().WithMessage("رمز الدولة مطلوب.")
            .Matches(@"^\d{1,4}$").WithMessage("رمز الدولة غير صحيح.");
        RuleFor(x => x.Input.DeliveryZoneId).NotNull().When(x => x.Input.NeedsDelivery).WithMessage("منطقة التوصيل مطلوبة.");
        RuleFor(x => x.Input.Address).NotEmpty().When(x => x.Input.NeedsDelivery).WithMessage("العنوان مطلوب عند التوصيل.")
            .MaximumLength(500).WithMessage("العنوان طويل جدًا.");
        RuleFor(x => x.Input.DiscountCode).MaximumLength(50).WithMessage("كود الخصم طويل جدًا.");
        RuleFor(x => x.IdempotencyKey).MaximumLength(128).WithMessage("مفتاح الطلب غير صالح.");
    }
}

public sealed class CreateOrderCommandHandler : IRequestHandler<CreateOrderCommand, CreateOrderResultDto>
{
    private readonly IApplicationDbContext _db;
    private readonly IRequestContext _request;
    private readonly IDeviceFingerprintService _fingerprint;
    private readonly IInvoiceNumberGenerator _invoices;
    private readonly IDateTimeProvider _clock;
    private readonly ICacheService _cache;

    public CreateOrderCommandHandler(IApplicationDbContext db, IRequestContext request, IDeviceFingerprintService fingerprint,
        IInvoiceNumberGenerator invoices, IDateTimeProvider clock, ICacheService cache)
    {
        _db = db; _request = request; _fingerprint = fingerprint; _invoices = invoices; _clock = clock; _cache = cache;
    }

    public async Task<CreateOrderResultDto> Handle(CreateOrderCommand command, CancellationToken ct)
    {
        var input = command.Input;
        var now = _clock.UtcNow;

        // 1) Idempotent replay (DB-level safety net; the API filter also replays from Redis).
        if (!string.IsNullOrWhiteSpace(command.IdempotencyKey))
        {
            var existing = await _db.Orders.AsNoTracking()
                .Where(o => o.IdempotencyKey == command.IdempotencyKey)
                .Select(o => new CreateOrderResultDto(o.InvoiceNumber, o.Total, o.DiscountAmount, o.Status))
                .FirstOrDefaultAsync(ct);
            if (existing is not null) return existing;
        }

        // 2) Resolve device (fingerprint header, or IP fallback treated strictly by rate limiting).
        var rawFingerprint = string.IsNullOrWhiteSpace(_request.DeviceFingerprint)
            ? $"ip:{_request.IpAddress ?? "unknown"}"
            : _request.DeviceFingerprint.Trim();
        var hash = _fingerprint.ComputeHash(rawFingerprint);

        var device = await _db.Devices.FirstOrDefaultAsync(d => d.DeviceHash == hash, ct);
        if (device is { IsBlocked: true })
            throw new RateLimitedException("تم حظر هذا الجهاز من إنشاء الطلبات.", ErrorCodes.DeviceBlocked);

        // 3) Load catalogue data for all lines in one round-trip each.
        var productIds = input.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await _db.Products
            .Include(p => p.Images).Include(p => p.Sizes).Include(p => p.Colors)
            .Where(p => productIds.Contains(p.Id))
            .ToListAsync(ct);

        var fieldErrors = new Dictionary<string, string>();
        var lines = new List<ResolvedLine>();
        for (var idx = 0; idx < input.Items.Count; idx++)
        {
            var item = input.Items[idx];
            var product = products.FirstOrDefault(p => p.Id == item.ProductId);
            if (product is null || !product.IsActive) { fieldErrors[$"items[{idx}].productId"] = "المنتج غير متوفر."; continue; }

            ProductSize? size = null;
            if (product.HasSizes)
            {
                if (!item.SizeId.HasValue) { fieldErrors[$"items[{idx}].sizeId"] = "يرجى اختيار المقاس."; continue; }
                size = product.Sizes.FirstOrDefault(s => s.Id == item.SizeId.Value);
                if (size is null) { fieldErrors[$"items[{idx}].sizeId"] = "المقاس غير متوفر."; continue; }
            }

            ProductColor? color = null;
            if (item.ColorId.HasValue)
            {
                color = product.Colors.FirstOrDefault(c => c.Id == item.ColorId.Value);
                if (color is null) { fieldErrors[$"items[{idx}].colorId"] = "اللون غير متوفر."; continue; }
            }
            else if (product.HasColors && product.Colors.Count > 0)
            {
                fieldErrors[$"items[{idx}].colorId"] = "يرجى اختيار اللون.";
                continue;
            }

            var unitPrice = size?.Price ?? product.EffectivePrice(now);
            lines.Add(new ResolvedLine(product, size, color, item.Quantity, unitPrice));
        }
        if (fieldErrors.Count > 0) throw new ValidationException(fieldErrors);

        // Merge duplicate lines (same product+size+color) so a single atomic decrement per stock row is issued.
        lines = lines
            .GroupBy(l => (l.Product.Id, l.Size?.Id, l.Color?.Id))
            .Select(g => g.First() with { Quantity = g.Sum(x => x.Quantity) })
            .ToList();

        // 4) Delivery + discount preview (validated inside the transaction again for the discount usage increment).
        DeliveryZone? zone = null;
        if (input.NeedsDelivery)
        {
            zone = await _db.DeliveryZones.FirstOrDefaultAsync(z => z.Id == input.DeliveryZoneId!.Value && z.IsActive, ct);
            if (zone is null) throw new ValidationException("deliveryZoneId", "منطقة التوصيل غير متوفرة.");
        }

        var subtotal = lines.Sum(l => l.UnitPrice * l.Quantity);
        DiscountCode? discount = null;
        var discountAmount = 0m;
        if (!string.IsNullOrWhiteSpace(input.DiscountCode))
        {
            var code = input.DiscountCode.Trim().ToUpperInvariant();
            discount = await _db.DiscountCodes.FirstOrDefaultAsync(d => d.Code == code, ct);
            var amount = DiscountCalculator.TryApply(discount, subtotal, now);
            if (amount is null) throw new ValidationException("discountCode", "كود الخصم غير صالح أو منتهي.");
            discountAmount = amount.Value;
        }
        var deliveryFee = zone?.ExtraFee ?? 0m;
        var total = subtotal - discountAmount + deliveryFee;

        // 5) Everything below is ONE transaction: stock decrements, order, items, logs, notifications, counters.
        return await _db.ExecuteInTransactionAsync(async tct =>
        {
            if (device is null)
            {
                device = new Device
                {
                    DeviceHash = hash,
                    DeviceHashEncrypted = _fingerprint.Encrypt(rawFingerprint),
                    CreatedAt = now
                };
                _db.Devices.Add(device);
            }

            var order = new Order
            {
                InvoiceNumber = await _invoices.NextAsync(now, tct),
                Status = OrderStatus.Pending,
                NeedsDelivery = input.NeedsDelivery,
                DeliveryZoneId = zone?.Id,
                Address = input.NeedsDelivery ? input.Address?.Trim() : null,
                CustomerName = input.CustomerName.Trim(),
                PhoneNumber = input.PhoneNumber.Trim(),
                WhatsAppCountryCode = input.WhatsAppCountryCode.Trim(),
                Subtotal = subtotal,
                DiscountCodeId = discount?.Id,
                DiscountAmount = discountAmount,
                DeliveryFee = deliveryFee,
                Total = total,
                Device = device,
                CreatedAt = now,
                EditableUntil = now.AddDays(Order.EditableWindowDays),
                IdempotencyKey = string.IsNullOrWhiteSpace(command.IdempotencyKey) ? null : command.IdempotencyKey
            };

            foreach (var line in lines)
            {
                // Atomic conditional decrement — 0 rows affected ⇒ insufficient stock ⇒ whole transaction rolls back (409 OUT_OF_STOCK).
                int affected;
                int stockAfter;
                if (line.Size is not null)
                {
                    affected = await _db.ProductSizes
                        .Where(s => s.Id == line.Size.Id && s.Stock >= line.Quantity)
                        .ExecuteUpdateAsync(s => s.SetProperty(x => x.Stock, x => x.Stock - line.Quantity).SetProperty(x => x.UpdatedAt, now), tct);
                    if (affected == 0) throw OutOfStock(line);
                    stockAfter = await _db.ProductSizes.AsNoTracking().Where(s => s.Id == line.Size.Id).Select(s => s.Stock).FirstAsync(tct);
                }
                else
                {
                    affected = await _db.Products
                        .Where(p => p.Id == line.Product.Id && p.Stock >= line.Quantity)
                        .ExecuteUpdateAsync(p => p.SetProperty(x => x.Stock, x => x.Stock - line.Quantity).SetProperty(x => x.UpdatedAt, now), tct);
                    if (affected == 0) throw OutOfStock(line);
                    stockAfter = await _db.Products.AsNoTracking().Where(p => p.Id == line.Product.Id).Select(p => p.Stock).FirstAsync(tct);
                }

                var primaryImage = line.Product.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).FirstOrDefault()?.Url;
                order.Items.Add(new OrderItem
                {
                    ProductId = line.Product.Id,
                    ProductSizeId = line.Size?.Id,
                    ProductColorId = line.Color?.Id,
                    ProductTitleSnapshot = line.Product.Title,
                    ProductImageUrlSnapshot = primaryImage,
                    SizeLabelSnapshot = line.Size?.Label,
                    ColorNameSnapshot = line.Color?.Name,
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    CreatedAt = now
                });

                _db.InventoryLogs.Add(new InventoryLog
                {
                    ProductId = line.Product.Id, ProductSizeId = line.Size?.Id, ChangeType = InventoryChangeType.Sale,
                    QuantityChanged = -line.Quantity, StockAfter = stockAfter, OrderId = order.Id, Note = $"بيع — فاتورة {order.InvoiceNumber}", CreatedAt = now
                });

                if (stockAfter <= 0)
                {
                    _db.InventoryLogs.Add(new InventoryLog
                    {
                        ProductId = line.Product.Id, ProductSizeId = line.Size?.Id, ChangeType = InventoryChangeType.Depleted,
                        QuantityChanged = 0, StockAfter = 0, OrderId = order.Id, Note = "نفاد المخزون", CreatedAt = now
                    });
                    _db.Notifications.Add(NotificationFactory.Depleted(line.Product, line.Size?.Label, now));
                }
                else if (stockAfter < InventoryRules.DefaultLowStockThreshold)
                {
                    _db.Notifications.Add(NotificationFactory.LowStock(line.Product, line.Size?.Label, stockAfter, now));
                }
            }

            if (discount is not null)
            {
                // UsageCount increments only on a successful order (never on /validate).
                await _db.DiscountCodes.Where(d => d.Id == discount.Id)
                    .ExecuteUpdateAsync(d => d.SetProperty(x => x.UsageCount, x => x.UsageCount + 1), tct);
            }

            device.TotalOrders++;
            device.LastOrderAt = now;
            device.UpdatedAt = now;

            _db.Orders.Add(order);
            _db.Notifications.Add(NotificationFactory.NewOrder(order, now));

            await _db.SaveChangesAsync(tct);

            foreach (var pid in productIds)
                await CacheInvalidation.ProductAsync(_cache, pid, tct);

            return new CreateOrderResultDto(order.InvoiceNumber, order.Total, order.DiscountAmount, order.Status);
        }, ct);
    }

    private static ConflictException OutOfStock(ResolvedLine line) =>
        new($"الكمية المطلوبة من «{line.Product.Title}»{(line.Size is null ? string.Empty : $" مقاس {line.Size.Label}")} غير متوفرة حاليًا.", ErrorCodes.OutOfStock);

    private sealed record ResolvedLine(Product Product, ProductSize? Size, ProductColor? Color, int Quantity, decimal UnitPrice);
}
