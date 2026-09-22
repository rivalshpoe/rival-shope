using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Interfaces;

namespace Store.Application.Features.Categories.Queries;

/// <summary>Public: active categories (cached 10 min). Admin: all categories, bypasses cache.</summary>
public sealed record GetCategoriesQuery(bool IncludeInactive = false) : IRequest<IReadOnlyList<CategoryDto>>;

public sealed class GetCategoriesQueryHandler : IRequestHandler<GetCategoriesQuery, IReadOnlyList<CategoryDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;

    public GetCategoriesQueryHandler(IApplicationDbContext db, ICacheService cache)
    {
        _db = db;
        _cache = cache;
    }

    public Task<IReadOnlyList<CategoryDto>> Handle(GetCategoriesQuery request, CancellationToken ct)
    {
        if (request.IncludeInactive) return Load(true, ct);
        return _cache.GetOrSetAsync(CacheKeys.CategoriesAll, CacheKeys.Ttl.Categories, c => Load(false, c), ct);
    }

    private async Task<IReadOnlyList<CategoryDto>> Load(bool includeInactive, CancellationToken ct)
    {
        var query = _db.Categories.AsNoTracking();
        if (!includeInactive) query = query.Where(c => c.IsActive);

        // Grouped projection: product count computed in SQL (active products only), no N+1.
        var list = await query
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(
                c.Id, c.Name, c.Slug, c.ImageUrl, c.ParentCategoryId, c.SortOrder, c.IsActive,
                c.Products.Count(p => p.IsActive && !p.IsDeleted)
                + c.Children.SelectMany(ch => ch.Products).Count(p => p.IsActive && !p.IsDeleted)))
            .ToListAsync(ct);

        return list;
    }
}
