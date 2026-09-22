using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;

namespace Store.Application.Features.Products.Queries;

public sealed record GetAdminProductsQuery(int? Page, int? PageSize, string? Search, Guid? CategoryId, bool? IsActive)
    : IRequest<PagedResult<AdminProductRowDto>>;

public sealed record GetAdminProductByIdQuery(Guid Id) : IRequest<AdminProductDetailsDto>;

public sealed class GetAdminProductsQueryHandler : IRequestHandler<GetAdminProductsQuery, PagedResult<AdminProductRowDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly IDateTimeProvider _clock;
    public GetAdminProductsQueryHandler(IApplicationDbContext db, IDateTimeProvider clock) { _db = db; _clock = clock; }

    public async Task<PagedResult<AdminProductRowDto>> Handle(GetAdminProductsQuery request, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var query = _db.Products.AsNoTracking();

        if (request.CategoryId.HasValue)
            query = query.Where(p => p.CategoryId == request.CategoryId.Value || p.Category.ParentCategoryId == request.CategoryId.Value);
        if (request.IsActive.HasValue)
            query = query.Where(p => p.IsActive == request.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            if (term.Length > 100) term = term[..100];
            var ids = _db.SearchProducts(term, activeOnly: false).Select(p => p.Id);
            query = query.Where(p => ids.Contains(p.Id) || p.Slug.Contains(term.ToLower()));
        }

        return await query
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new AdminProductRowDto(
                p.Id, p.Title, p.Slug,
                p.Images.Where(i => i.IsPrimary).Select(i => i.Url).FirstOrDefault()
                    ?? p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.CategoryId, p.Category.Name,
                p.Brand != null ? p.Brand.Name : null,
                p.Price, p.DiscountPrice,
                p.DiscountPrice != null && p.DiscountPrice < p.Price
                    && (p.DiscountStartAt == null || p.DiscountStartAt <= now)
                    && (p.DiscountEndAt == null || p.DiscountEndAt >= now),
                p.HasSizes,
                p.HasSizes ? (p.Sizes.Sum(s => (int?)s.Stock) ?? 0) : p.Stock,
                p.IsActive, p.CreatedAt))
            .ToPagedResultAsync(request.Page, request.PageSize, ct);
    }
}

public sealed class GetAdminProductByIdQueryHandler : IRequestHandler<GetAdminProductByIdQuery, AdminProductDetailsDto>
{
    private readonly IApplicationDbContext _db;
    private readonly IDateTimeProvider _clock;
    public GetAdminProductByIdQueryHandler(IApplicationDbContext db, IDateTimeProvider clock) { _db = db; _clock = clock; }

    public async Task<AdminProductDetailsDto> Handle(GetAdminProductByIdQuery request, CancellationToken ct)
    {
        var product = await _db.Products.AsNoTracking()
            .Include(p => p.Category).Include(p => p.Brand)
            .Include(p => p.Images).Include(p => p.Colors).Include(p => p.Sizes)
            .FirstOrDefaultAsync(p => p.Id == request.Id, ct)
            ?? throw new NotFoundException("المنتج", request.Id);

        var related = await _db.Products.AsNoTracking()
            .Where(r => r.CategoryId == product.CategoryId && r.IsActive && r.Id != product.Id)
            .OrderByDescending(r => r.CreatedAt).Take(8).Select(r => r.Id).ToListAsync(ct);

        return AdminProductMapping.ToDetails(product, related, _clock.UtcNow);
    }
}

internal static class AdminProductMapping
{
    public static AdminProductDetailsDto ToDetails(Domain.Entities.Product p, IReadOnlyList<Guid> related, DateTime now) => new(
        p.Id, p.Title, p.Slug, p.Description,
        p.CategoryId, p.Category?.Name ?? string.Empty, p.Category?.Slug ?? string.Empty,
        p.BrandId, p.Brand is null ? null : new BrandRefDto(p.Brand.Id, p.Brand.Name, p.Brand.Slug),
        p.Price, p.DiscountPrice, p.DiscountStartAt, p.DiscountEndAt, p.IsDiscountActive(now),
        p.HasSizes, p.HasColors, p.Stock, p.IsActive,
        p.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder)
            .Select(i => new AdminProductImageDto(i.Id, i.Url, i.ThumbnailUrl, i.IsPrimary, i.SortOrder)).ToList(),
        p.Colors.Select(c => new ProductColorDto(c.Id, c.Name, c.HexCode)).ToList(),
        p.Sizes.OrderBy(s => s.CreatedAt).Select(s => new AdminProductSizeDto(s.Id, s.Label, s.Price, s.Stock, s.Stock > 0)).ToList(),
        related, p.CreatedAt, p.UpdatedAt);
}
