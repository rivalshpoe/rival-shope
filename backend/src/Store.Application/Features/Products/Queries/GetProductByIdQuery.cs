using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;

namespace Store.Application.Features.Products.Queries;

public sealed record GetProductByIdQuery(Guid Id) : IRequest<ProductDetailsDto>;

public sealed class GetProductByIdQueryHandler : IRequestHandler<GetProductByIdQuery, ProductDetailsDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;
    private readonly IDateTimeProvider _clock;

    public GetProductByIdQueryHandler(IApplicationDbContext db, ICacheService cache, IDateTimeProvider clock)
    {
        _db = db; _cache = cache; _clock = clock;
    }

    public async Task<ProductDetailsDto> Handle(GetProductByIdQuery request, CancellationToken ct)
    {
        var dto = await _cache.GetOrSetAsync<ProductDetailsDto?>(CacheKeys.ProductDetail(request.Id), CacheKeys.Ttl.ProductDetail, Load(request.Id), ct);
        return dto ?? throw new NotFoundException("المنتج", request.Id);
    }

    private Func<CancellationToken, Task<ProductDetailsDto?>> Load(Guid id) => async ct =>
    {
        var now = _clock.UtcNow;
        var p = await _db.Products.AsNoTracking()
            .Where(x => x.Id == id && x.IsActive)
            .Select(x => new
            {
                x.Id, x.Title, x.Slug, x.Description, x.Price, x.DiscountPrice, x.DiscountStartAt, x.DiscountEndAt,
                x.Stock, x.HasSizes, x.HasColors, x.CategoryId,
                CategoryName = x.Category.Name, CategorySlug = x.Category.Slug,
                Brand = x.Brand != null ? new BrandRefDto(x.Brand.Id, x.Brand.Name, x.Brand.Slug) : null,
                Images = x.Images.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).Select(i => new ProductImageDto(i.Url, i.IsPrimary, i.SortOrder)).ToList(),
                Colors = x.Colors.Select(c => new ProductColorDto(c.Id, c.Name, c.HexCode)).ToList(),
                Sizes = x.Sizes.OrderBy(s => s.CreatedAt).Select(s => new ProductSizeDto(s.Id, s.Label, s.Price, s.Stock > 0)).ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (p is null) return null;

        var related = await _db.Products.AsNoTracking()
            .Where(r => r.CategoryId == p.CategoryId && r.IsActive && r.Id != p.Id)
            .OrderByDescending(r => r.CreatedAt)
            .Take(8)
            .Select(r => r.Id)
            .ToListAsync(ct);

        var isDiscountActive = p.DiscountPrice.HasValue && p.DiscountPrice < p.Price
            && (!p.DiscountStartAt.HasValue || p.DiscountStartAt <= now)
            && (!p.DiscountEndAt.HasValue || p.DiscountEndAt >= now);

        return new ProductDetailsDto(p.Id, p.Title, p.Slug, p.Description, p.Images, p.Colors, p.Sizes,
            p.Price, p.DiscountPrice, isDiscountActive,
            p.HasSizes ? p.Sizes.Count(s => s.InStock) : p.Stock,
            p.HasSizes, p.HasColors, p.CategoryId, p.CategoryName, p.CategorySlug, p.Brand, related);
    };
}
