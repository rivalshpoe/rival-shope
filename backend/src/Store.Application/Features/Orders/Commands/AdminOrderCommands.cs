using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Domain.Entities;
using Store.Domain.Enums;
using Store.Domain.Exceptions;

namespace Store.Application.Features.Orders.Commands;

public sealed record UpdateOrderStatusCommand(Guid Id, OrderStatus Status) : IRequest<AdminOrderDetailsDto>;
public sealed record CollectOrdersCommand(IReadOnlyList<string> InvoiceNumbers) : IRequest<CollectResultDto>;

public sealed class UpdateOrderStatusCommandValidator : AbstractValidator<UpdateOrderStatusCommand>
{
    public UpdateOrderStatusCommandValidator()
    {
        RuleFor(x => x.Status).Must(s => s is OrderStatus.Confirmed or OrderStatus.Cancelled or OrderStatus.Fake)
            .WithMessage("الحالة المطلوبة غير مسموحة (Confirmed | Cancelled | Fake).");
    }
}

public sealed class CollectOrdersCommandValidator : AbstractValidator<CollectOrdersCommand>
{
    public CollectOrdersCommandValidator()
    {
        RuleFor(x => x.InvoiceNumbers).NotEmpty().WithMessage("يرجى تحديد فاتورة واحدة على الأقل.")
            .Must(l => l is null || l.Count <= 200).WithMessage("عدد الفواتير كبير جدًا (الحد 200).");
    }
}

public sealed class UpdateOrderStatusCommandHandler : IRequestHandler<UpdateOrderStatusCommand, AdminOrderDetailsDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock; private readonly ICacheService _cache;
    public UpdateOrderStatusCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock, ICacheService cache) { _db = db; _audit = audit; _clock = clock; _cache = cache; }

    public async Task<AdminOrderDetailsDto> Handle(UpdateOrderStatusCommand request, CancellationToken ct)
    {
        var now = _clock.UtcNow;

        return await _db.ExecuteInTransactionAsync(async tct =>
        {
            var order = await _db.Orders
                .Include(o => o.Items).Include(o => o.Device)
                .Include(o => o.DeliveryZone).Include(o => o.DiscountCode)
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(o => o.Id == request.Id, tct)
                ?? throw new NotFoundException("الطلب", request.Id);

            var previous = order.Status;
            bool returnsStock;
            try
            {
                returnsStock = order.ChangeStatus(request.Status, now);
            }
            catch (DomainException ex)
            {
                throw new ConflictException(ex.Message, ex.ErrorCode);
            }

            if (returnsStock)
            {
                foreach (var item in order.Items)
                {
                    int stockAfter;
                    if (item.ProductSizeId.HasValue)
                    {
                        await _db.ProductSizes.IgnoreQueryFilters().Where(s => s.Id == item.ProductSizeId.Value)
                            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Stock, x => x.Stock + item.Quantity).SetProperty(x => x.UpdatedAt, now), tct);
                        stockAfter = await _db.ProductSizes.IgnoreQueryFilters().AsNoTracking().Where(s => s.Id == item.ProductSizeId.Value).Select(s => s.Stock).FirstOrDefaultAsync(tct);
                    }
                    else
                    {
                        await _db.Products.IgnoreQueryFilters().Where(p => p.Id == item.ProductId)
                            .ExecuteUpdateAsync(p => p.SetProperty(x => x.Stock, x => x.Stock + item.Quantity).SetProperty(x => x.UpdatedAt, now), tct);
                        stockAfter = await _db.Products.IgnoreQueryFilters().AsNoTracking().Where(p => p.Id == item.ProductId).Select(p => p.Stock).FirstOrDefaultAsync(tct);
                    }

                    _db.InventoryLogs.Add(new InventoryLog
                    {
                        ProductId = item.ProductId, ProductSizeId = item.ProductSizeId, ChangeType = InventoryChangeType.Return,
                        QuantityChanged = item.Quantity, StockAfter = stockAfter, OrderId = order.Id,
                        Note = $"إرجاع من {(request.Status == OrderStatus.Fake ? "طلب وهمي" : "إلغاء")} — فاتورة {order.InvoiceNumber}", CreatedAt = now
                    });
                }
            }

            if (request.Status == OrderStatus.Fake)
            {
                var blocked = order.Device.RegisterFakeOrder(now);
                if (blocked)
                    _audit.Log("DeviceAutoBlocked", nameof(Device), order.Device.Id, $"بلوغ {Device.AutoBlockThreshold} طلبات وهمية");
            }

            // The "new order" notification is resolved automatically once the admin acts on the order.
            var notifications = await _db.Notifications
                .Where(n => n.RelatedOrderId == order.Id && !n.IsResolved && n.Type == NotificationType.NewOrder)
                .ToListAsync(tct);
            foreach (var n in notifications) n.Resolve(now);

            _audit.Log("OrderStatusChanged", nameof(Order), order.Id, $"{previous} → {request.Status} ({order.InvoiceNumber})");
            await _db.SaveChangesAsync(tct);

            if (returnsStock)
                foreach (var pid in order.Items.Select(i => i.ProductId).Distinct())
                    await CacheInvalidation.ProductAsync(_cache, pid, tct);

            return OrderMapping.ToDetails(order, now);
        }, ct);
    }
}

public sealed class CollectOrdersCommandHandler : IRequestHandler<CollectOrdersCommand, CollectResultDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public CollectOrdersCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _audit = audit; _clock = clock; }

    public async Task<CollectResultDto> Handle(CollectOrdersCommand request, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var wanted = request.InvoiceNumbers.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim().ToUpperInvariant()).Distinct().ToList();

        return await _db.ExecuteInTransactionAsync(async tct =>
        {
            // Only Confirmed orders can be collected (TotalCollected = Confirmed && IsCollected — spec §9).
            var orders = await _db.Orders
                .Where(o => wanted.Contains(o.InvoiceNumber) && o.Status == OrderStatus.Confirmed)
                .ToListAsync(tct);

            var found = orders.Select(o => o.InvoiceNumber).ToHashSet();
            var notFound = wanted.Where(w => !found.Contains(w)).ToList();

            var collected = 0;
            var amount = 0m;
            foreach (var o in orders.Where(o => !o.IsCollected))
            {
                o.IsCollected = true;
                o.CollectedAt = now;
                o.UpdatedAt = now;
                collected++;
                amount += o.Total;
            }

            _audit.Log("OrdersCollected", nameof(Order), null, $"{collected} فاتورة بقيمة {amount:0.##}");
            await _db.SaveChangesAsync(tct);
            return new CollectResultDto(collected, amount, notFound);
        }, ct);
    }
}
