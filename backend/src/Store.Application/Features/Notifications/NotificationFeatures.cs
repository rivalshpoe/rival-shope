using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;
using Store.Domain.Entities;
using Store.Domain.Enums;

namespace Store.Application.Features.Notifications;

public sealed record NotificationDto(Guid Id, NotificationType Type, string Title, string Message, Guid? RelatedOrderId, Guid? RelatedProductId, bool IsResolved, DateTime CreatedAt, DateTime? ResolvedAt);

public sealed record GetNotificationsQuery(bool UnresolvedOnly, int? Page, int? PageSize) : IRequest<PagedResult<NotificationDto>>;
public sealed record ResolveNotificationCommand(Guid Id) : IRequest<NotificationDto>;

public sealed class GetNotificationsQueryHandler : IRequestHandler<GetNotificationsQuery, PagedResult<NotificationDto>>
{
    private readonly IApplicationDbContext _db;
    public GetNotificationsQueryHandler(IApplicationDbContext db) => _db = db;

    public Task<PagedResult<NotificationDto>> Handle(GetNotificationsQuery request, CancellationToken ct)
    {
        var q = _db.Notifications.AsNoTracking();
        if (request.UnresolvedOnly) q = q.Where(n => !n.IsResolved);
        return q.OrderByDescending(n => n.CreatedAt)
            .Select(n => new NotificationDto(n.Id, n.Type, n.Title, n.Message, n.RelatedOrderId, n.RelatedProductId, n.IsResolved, n.CreatedAt, n.ResolvedAt))
            .ToPagedResultAsync(request.Page, request.PageSize, ct);
    }
}

public sealed class ResolveNotificationCommandHandler : IRequestHandler<ResolveNotificationCommand, NotificationDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public ResolveNotificationCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _audit = audit; _clock = clock; }

    public async Task<NotificationDto> Handle(ResolveNotificationCommand request, CancellationToken ct)
    {
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == request.Id, ct) ?? throw new NotFoundException("الإشعار", request.Id);
        n.Resolve(_clock.UtcNow);
        _audit.Log("NotificationResolved", nameof(Notification), n.Id);
        await _db.SaveChangesAsync(ct);
        return new NotificationDto(n.Id, n.Type, n.Title, n.Message, n.RelatedOrderId, n.RelatedProductId, n.IsResolved, n.CreatedAt, n.ResolvedAt);
    }
}

/// <summary>Factory helpers so notification wording lives in one place.</summary>
public static class NotificationFactory
{
    public static Notification NewOrder(Order order, DateTime now) => new()
    {
        Type = NotificationType.NewOrder,
        Title = "طلب جديد",
        Message = $"طلب جديد {order.InvoiceNumber} من {order.CustomerName} بقيمة {order.Total:0.##}",
        RelatedOrderId = order.Id,
        CreatedAt = now
    };

    public static Notification LowStock(Product product, string? sizeLabel, int stock, DateTime now) => new()
    {
        Type = NotificationType.LowStock,
        Title = "مخزون منخفض",
        Message = sizeLabel is null
            ? $"المنتج «{product.Title}» بقي منه {stock} فقط"
            : $"المنتج «{product.Title}» مقاس {sizeLabel} بقي منه {stock} فقط",
        RelatedProductId = product.Id,
        CreatedAt = now
    };

    public static Notification Depleted(Product product, string? sizeLabel, DateTime now) => new()
    {
        Type = NotificationType.Depleted,
        Title = "نفاد المخزون",
        Message = sizeLabel is null
            ? $"نفد مخزون المنتج «{product.Title}»"
            : $"نفد مخزون المنتج «{product.Title}» مقاس {sizeLabel}",
        RelatedProductId = product.Id,
        CreatedAt = now
    };
}
