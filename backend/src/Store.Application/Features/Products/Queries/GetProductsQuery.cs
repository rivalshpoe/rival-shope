using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;

namespace Store.Application.Features.Products.Queries;

/// <summary>Public paged product list. Page size is capped at 50 server-side. Cached 5 minutes per filter signature.</summary>
public sealed record GetProductsQuery(
    Guid? CategoryId,
    Guid? SubCategoryId,
    string? CategorySlug,
    Guid? BrandId,
    string? BrandSlug,
    string? Search,
    string? Sort,
    int? Page,
    int? PageSize) : IRequest<PagedResult<ProductListItemDto>>;

public sealed class GetProductsQueryValidator : AbstractValidator<GetProductsQuery>
{
    public GetProductsQueryValidator()
    {
        RuleFor(x => x.Search).MaximumLength(100).WithMessage("نص البحث طويل جدًا (الحد 100 حرف).");
        RuleFor(x => x.CategorySlug).MaximumLength(150);
        RuleFor(x => x.BrandSlug).MaximumLength(150);
    }
}

public sealed class GetProductsQueryHandler : IRequestHandler<GetProductsQuery, PagedResult<ProductListItemDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;
    private readonly IDateTimeProvider _clock;

    public GetProductsQueryHandler(IApplicationDbContext db, ICacheService cache, IDateTimeProvider clock)
    {
        _db = db; _cache = cache; _clock = clock;
    }

    public Task<PagedResult<ProductListItemDto>> Handle(GetProductsQuery request, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(request.Page, request.PageSize);
        var sort = ProductProjections.ParseSort(request.Sort);
        var signature = string.Join(':',
            request.CategoryId?.ToString() ?? "-", request.SubCategoryId?.ToString() ?? "-",
            request.CategorySlug ?? "-", request.BrandId?.ToString() ?? "-", request.BrandSlug ?? "-",
            (request.Search ?? "-").Trim().ToLowerInvariant(), sort, page, pageSize);

        // Free-text searches are not cached under the product list key (they go through the search cache instead).
        if (!string.IsNullOrWhiteSpace(request.Search))
            return Load(request, sort, page, pageSize, ct);

        return _cache.GetOrSetAsync(CacheKeys.ProductsList(signature), CacheKeys.Ttl.ProductsList,
            c => Load(request, sort, page, pageSize, c), ct);
    }

    private async Task<PagedResult<ProductListItemDto>> Load(GetProductsQuery request, ProductSort sort, int page, int pageSize, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var query = _db.Products.AsNoTracking().Where(p => p.IsActive && p.Category.IsActive);

        Guid? categoryId = request.CategoryId;
        if (!string.IsNullOrWhiteSpace(request.CategorySlug))
        {
            var slug = request.CategorySlug.Trim().ToLowerInvariant();
            categoryId = await _db.Categories.AsNoTracking().Where(c => c.Slug == slug).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct);
            if (categoryId is null) return PagedResult<ProductListItemDto>.Empty(page, pageSize);
        }

        if (request.SubCategoryId.HasValue)
            query = query.Where(p => p.CategoryId == request.SubCategoryId.Value);
        else if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value || p.Category.ParentCategoryId == categoryId.Value);

        Guid? brandId = request.BrandId;
        if (!string.IsNullOrWhiteSpace(request.BrandSlug))
        {
            var bslug = request.BrandSlug.Trim().ToLowerInvariant();
            brandId = await _db.Brands.AsNoTracking().Where(b => b.Slug == bslug).Select(b => (Guid?)b.Id).FirstOrDefaultAsync(ct);
            if (brandId is null) return PagedResult<ProductListItemDto>.Empty(page, pageSize);
        }
        if (brandId.HasValue) query = query.Where(p => p.BrandId == brandId.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var ids = _db.SearchProducts(request.Search.Trim()).Select(p => p.Id);
            query = query.Where(p => ids.Contains(p.Id));
        }

        query = ProductProjections.ApplySort(query, sort, now);
        return await query.Select(ProductProjections.ListItem(now)).ToPagedResultAsync(page, pageSize, ct);
    }
}
