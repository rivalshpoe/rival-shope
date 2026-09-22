using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;

namespace Store.Application.Features.Products.Queries;

/// <summary>Public search. <c>q</c> longer than 100 chars is rejected with 400 SEARCH_TOO_LONG before touching the database.</summary>
public sealed record SearchProductsQuery(string? Q, int? Page, int? PageSize) : IRequest<PagedResult<ProductListItemDto>>;

public sealed class SearchProductsQueryHandler : IRequestHandler<SearchProductsQuery, PagedResult<ProductListItemDto>>
{
    public const int MaxQueryLength = 100;

    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;
    private readonly IDateTimeProvider _clock;

    public SearchProductsQueryHandler(IApplicationDbContext db, ICacheService cache, IDateTimeProvider clock)
    {
        _db = db; _cache = cache; _clock = clock;
    }

    public Task<PagedResult<ProductListItemDto>> Handle(SearchProductsQuery request, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(request.Page, request.PageSize);
        var q = (request.Q ?? string.Empty).Trim();

        if (q.Length > MaxQueryLength)
            throw new BadRequestException($"نص البحث طويل جدًا (الحد الأقصى {MaxQueryLength} حرفًا).", ErrorCodes.SearchTooLong);
        if (q.Length == 0)
            return Task.FromResult(PagedResult<ProductListItemDto>.Empty(page, pageSize));

        return _cache.GetOrSetAsync(CacheKeys.Search(q, page, pageSize), CacheKeys.Ttl.Search, async c =>
        {
            var now = _clock.UtcNow;
            return await _db.SearchProducts(q)
                .AsNoTracking()
                .Where(p => p.Category.IsActive)
                .Select(ProductProjections.ListItem(now))
                .ToPagedResultAsync(page, pageSize, c);
        }, ct);
    }
}
