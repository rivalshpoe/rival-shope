using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;
using Store.Domain.Entities;
using Store.Domain.Enums;

namespace Store.Application.Features.Orders.Queries;

public sealed record GetAdminOrdersQuery(OrderStatus? Status, string? Search, DateTime? From, DateTime? To, bool? IsCollected, int? Page, int? PageSize)
    : IRequest<PagedResult<AdminOrderRowDto>>;

public sealed record GetCollectedOrdersQuery(int? Page, int? PageSize) : IRequest<PagedResult<AdminOrderRowDto>>;
public sealed record GetAdminOrderByIdQuery(Guid Id) : IRequest<AdminOrderDetailsDto>;

internal static class OrderQueryHelpers
{
    public static IQueryable<AdminOrderRowDto> ProjectRows(IQueryable<Order> q) => q.Select(o => new AdminOrderRowDto(
        o.Id, o.InvoiceNumber, o.CustomerName, o.PhoneNumber, o.WhatsAppCountryCode, o.Total, o.Status,
        o.Items.Sum(i => i.Quantity), o.IsCollected, o.CreatedAt));

    public static DateTime? ToUtc(DateTime? dt) => dt switch
    {
        null => null,
        { Kind: DateTimeKind.Utc } v => v,
        { Kind: DateTimeKind.Local } v => v.ToUniversalTime(),
        var v => DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)
    };
}

public sealed class GetAdminOrdersQueryHandler : IRequestHandler<GetAdminOrdersQuery, PagedResult<AdminOrderRowDto>>
{
    private readonly IApplicationDbContext _db;
    public GetAdminOrdersQueryHandler(IApplicationDbContext db) => _db = db;

    public Task<PagedResult<AdminOrderRowDto>> Handle(GetAdminOrdersQuery request, CancellationToken ct)
    {
        var q = _db.Orders.AsNoTracking();
        if (request.Status.HasValue) q = q.Where(o => o.Status == request.Status.Value);
        if (request.IsCollected.HasValue) q = q.Where(o => o.IsCollected == request.IsCollected.Value);
        var from = OrderQueryHelpers.ToUtc(request.From);
        var to = OrderQueryHelpers.ToUtc(request.To);
        if (from.HasValue) q = q.Where(o => o.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(o => o.CreatedAt <= to.Value);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            if (term.Length > 100) term = term[..100];
            var upper = term.ToUpperInvariant();
            q = q.Where(o => o.InvoiceNumber.Contains(upper) || o.CustomerName.Contains(term) || o.PhoneNumber.Contains(term));
        }

        return OrderQueryHelpers.ProjectRows(q.OrderByDescending(o => o.CreatedAt)).ToPagedResultAsync(request.Page, request.PageSize, ct);
    }
}

public sealed class GetCollectedOrdersQueryHandler : IRequestHandler<GetCollectedOrdersQuery, PagedResult<AdminOrderRowDto>>
{
    private readonly IApplicationDbContext _db;
    public GetCollectedOrdersQueryHandler(IApplicationDbContext db) => _db = db;

    public Task<PagedResult<AdminOrderRowDto>> Handle(GetCollectedOrdersQuery request, CancellationToken ct) =>
        OrderQueryHelpers.ProjectRows(_db.Orders.AsNoTracking().Where(o => o.IsCollected).OrderByDescending(o => o.CollectedAt))
            .ToPagedResultAsync(request.Page, request.PageSize, ct);
}

public sealed class GetAdminOrderByIdQueryHandler : IRequestHandler<GetAdminOrderByIdQuery, AdminOrderDetailsDto>
{
    private readonly IApplicationDbContext _db; private readonly IDateTimeProvider _clock;
    public GetAdminOrderByIdQueryHandler(IApplicationDbContext db, IDateTimeProvider clock) { _db = db; _clock = clock; }

    public async Task<AdminOrderDetailsDto> Handle(GetAdminOrderByIdQuery request, CancellationToken ct)
    {
        var order = await _db.Orders.AsNoTracking()
            .IgnoreQueryFilters() // soft-deleted zones/discount codes must still resolve for historical invoices
            .Include(o => o.Items).Include(o => o.Device).Include(o => o.DeliveryZone).Include(o => o.DiscountCode)
            .FirstOrDefaultAsync(o => o.Id == request.Id, ct)
            ?? throw new NotFoundException("الطلب", request.Id);
        return OrderMapping.ToDetails(order, _clock.UtcNow);
    }
}
