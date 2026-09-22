using Microsoft.EntityFrameworkCore;

namespace Store.Application.Common.Models;

public sealed record PaginationDto(int Page, int PageSize, int TotalItems, int TotalPages);

public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public PaginationDto Pagination { get; init; } = new(1, 10, 0, 0);

    public static PagedResult<T> Create(IReadOnlyList<T> items, int page, int pageSize, int totalItems) => new()
    {
        Items = items,
        Pagination = new PaginationDto(page, pageSize, totalItems, pageSize == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize))
    };

    public static PagedResult<T> Empty(int page, int pageSize) => Create(Array.Empty<T>(), page, pageSize, 0);
}

/// <summary>Server-enforced paging limits (spec §5: pageSize capped at 50 regardless of client input).</summary>
public static class Paging
{
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 50;

    public static (int Page, int PageSize) Normalize(int? page, int? pageSize)
    {
        var p = page.GetValueOrDefault(1);
        if (p < 1) p = 1;
        var ps = pageSize.GetValueOrDefault(DefaultPageSize);
        if (ps < 1) ps = DefaultPageSize;
        if (ps > MaxPageSize) ps = MaxPageSize;
        return (p, ps);
    }

    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(this IQueryable<T> query, int? page, int? pageSize, CancellationToken ct)
    {
        var (p, ps) = Normalize(page, pageSize);
        var total = await query.CountAsync(ct);
        if (total == 0) return PagedResult<T>.Empty(p, ps);
        var items = await query.Skip((p - 1) * ps).Take(ps).ToListAsync(ct);
        return PagedResult<T>.Create(items, p, ps, total);
    }

    public static PagedResult<T> ToPagedResult<T>(this IReadOnlyList<T> source, int? page, int? pageSize)
    {
        var (p, ps) = Normalize(page, pageSize);
        var items = source.Skip((p - 1) * ps).Take(ps).ToList();
        return PagedResult<T>.Create(items, p, ps, source.Count);
    }
}
