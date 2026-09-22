using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Interfaces;
using Store.Application.Features.Inventory;
using Store.Domain.Enums;

namespace Store.Application.Features.Analytics;

public sealed record SalesByDayDto(DateOnly Date, decimal Total, int Count);
public sealed record TopProductDto(Guid ProductId, string Title, int Quantity, decimal Revenue);

public sealed record AnalyticsSummaryDto(
    int OrdersCount,
    int PendingCount,
    int ConfirmedCount,
    int CancelledCount,
    int FakeCount,
    decimal TotalSold,
    decimal TotalCollected,
    decimal TotalUncollected,
    int ProductsCount,
    int LowStockCount,
    int DepletedCount,
    int TodayOrders,
    decimal TodaySales,
    IReadOnlyList<SalesByDayDto> SalesByDay,
    IReadOnlyList<TopProductDto> TopProducts);

/// <summary>Sales metrics exclude Fake orders entirely (spec §8/§9). Range defaults to the last 30 days for salesByDay.</summary>
public sealed record GetAnalyticsSummaryQuery(DateTime? From, DateTime? To) : IRequest<AnalyticsSummaryDto>;

public sealed class GetAnalyticsSummaryQueryHandler : IRequestHandler<GetAnalyticsSummaryQuery, AnalyticsSummaryDto>
{
    private readonly IApplicationDbContext _db;
    private readonly IDateTimeProvider _clock;
    public GetAnalyticsSummaryQueryHandler(IApplicationDbContext db, IDateTimeProvider clock) { _db = db; _clock = clock; }

    public async Task<AnalyticsSummaryDto> Handle(GetAnalyticsSummaryQuery request, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var todayStart = new DateTime(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);
        var from = ToUtc(request.From) ?? todayStart.AddDays(-29);
        var to = ToUtc(request.To) ?? now;
        if (to < from) (from, to) = (to, from);

        var orders = _db.Orders.AsNoTracking().Where(o => o.CreatedAt >= from && o.CreatedAt <= to);

        // One grouped round-trip for status counts + sold/collected sums.
        var byStatus = await orders
            .GroupBy(o => o.Status)
            .Select(g => new
            {
                Status = g.Key,
                Count = g.Count(),
                Total = g.Sum(o => o.Total),
                Collected = g.Where(o => o.IsCollected).Sum(o => o.Total)
            })
            .ToListAsync(ct);

        int Count(OrderStatus s) => byStatus.FirstOrDefault(x => x.Status == s)?.Count ?? 0;
        var confirmed = byStatus.FirstOrDefault(x => x.Status == OrderStatus.Confirmed);
        var totalSold = confirmed?.Total ?? 0m;
        var totalCollected = confirmed?.Collected ?? 0m;

        var todayAgg = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= todayStart && o.Status != OrderStatus.Fake)
            .GroupBy(_ => 1)
            .Select(g => new { Orders = g.Count(), Sales = g.Where(o => o.Status == OrderStatus.Confirmed).Sum(o => o.Total) })
            .FirstOrDefaultAsync(ct);

        var salesByDay = await orders
            .Where(o => o.Status == OrderStatus.Confirmed)
            .GroupBy(o => o.CreatedAt.Date)
            .Select(g => new { Date = g.Key, Total = g.Sum(o => o.Total), Count = g.Count() })
            .OrderBy(x => x.Date)
            .ToListAsync(ct);

        var topProducts = await _db.OrderItems.AsNoTracking()
            .Where(oi => oi.Order.Status != OrderStatus.Fake && oi.Order.Status != OrderStatus.Cancelled
                         && oi.Order.CreatedAt >= from && oi.Order.CreatedAt <= to)
            .GroupBy(oi => new { oi.ProductId, oi.ProductTitleSnapshot })
            // Project to an anonymous type first: EF cannot translate OrderBy over members of a
            // constructor-projected record, so the DTO is materialised after the query runs.
            .Select(g => new
            {
                g.Key.ProductId,
                g.Key.ProductTitleSnapshot,
                Quantity = g.Sum(x => x.Quantity),
                Revenue = g.Sum(x => x.Quantity * x.UnitPrice)
            })
            .OrderByDescending(x => x.Quantity).ThenByDescending(x => x.Revenue)
            .Take(10)
            .Select(x => new TopProductDto(x.ProductId, x.ProductTitleSnapshot, x.Quantity, Math.Round(x.Revenue, 2)))
            .ToListAsync(ct);

        var threshold = InventoryRules.DefaultLowStockThreshold;
        var productsCount = await _db.Products.AsNoTracking().CountAsync(p => p.IsActive, ct);
        var lowProducts = await _db.Products.AsNoTracking().CountAsync(p => p.IsActive && !p.HasSizes && p.Stock > 0 && p.Stock < threshold, ct);
        var depletedProducts = await _db.Products.AsNoTracking().CountAsync(p => p.IsActive && !p.HasSizes && p.Stock <= 0, ct);
        var lowSizes = await _db.ProductSizes.AsNoTracking().CountAsync(s => s.Product.IsActive && s.Product.HasSizes && s.Stock > 0 && s.Stock < threshold, ct);
        var depletedSizes = await _db.ProductSizes.AsNoTracking().CountAsync(s => s.Product.IsActive && s.Product.HasSizes && s.Stock <= 0, ct);

        return new AnalyticsSummaryDto(
            OrdersCount: byStatus.Sum(x => x.Count),
            PendingCount: Count(OrderStatus.Pending),
            ConfirmedCount: Count(OrderStatus.Confirmed),
            CancelledCount: Count(OrderStatus.Cancelled),
            FakeCount: Count(OrderStatus.Fake),
            TotalSold: totalSold,
            TotalCollected: totalCollected,
            TotalUncollected: totalSold - totalCollected,
            ProductsCount: productsCount,
            LowStockCount: lowProducts + lowSizes,
            DepletedCount: depletedProducts + depletedSizes,
            TodayOrders: todayAgg?.Orders ?? 0,
            TodaySales: todayAgg?.Sales ?? 0m,
            SalesByDay: salesByDay.Select(x => new SalesByDayDto(DateOnly.FromDateTime(x.Date), x.Total, x.Count)).ToList(),
            TopProducts: topProducts);
    }

    private static DateTime? ToUtc(DateTime? dt) => dt switch
    {
        null => null,
        { Kind: DateTimeKind.Utc } v => v,
        { Kind: DateTimeKind.Local } v => v.ToUniversalTime(),
        var v => DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)
    };
}
