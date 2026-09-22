using System.Linq.Expressions;
using Store.Domain.Entities;

namespace Store.Application.Features.Products;

public sealed record ProductListItemDto(
    Guid Id,
    string Title,
    string Slug,
    string? PrimaryImageUrl,
    decimal Price,
    decimal? DiscountPrice,
    bool IsDiscountActive,
    bool HasSizes,
    bool HasColors,
    Guid CategoryId,
    Guid? BrandId,
    string? BrandName,
    string? BrandSlug);

public sealed record ProductImageDto(string Url, bool IsPrimary, int SortOrder);
public sealed record ProductColorDto(Guid Id, string Name, string Hex);
public sealed record ProductSizeDto(Guid Id, string Label, decimal Price, bool InStock);
public sealed record BrandRefDto(Guid Id, string Name, string Slug);

public sealed record ProductDetailsDto(
    Guid Id,
    string Title,
    string Slug,
    string Description,
    IReadOnlyList<ProductImageDto> Images,
    IReadOnlyList<ProductColorDto> Colors,
    IReadOnlyList<ProductSizeDto> Sizes,
    decimal Price,
    decimal? DiscountPrice,
    bool IsDiscountActive,
    int Stock,
    bool HasSizes,
    bool HasColors,
    Guid CategoryId,
    string CategoryName,
    string CategorySlug,
    BrandRefDto? Brand,
    IReadOnlyList<Guid> RelatedProductIds);

// ---------- Admin ----------

public sealed record AdminProductRowDto(
    Guid Id,
    string Title,
    string Slug,
    string? PrimaryImageUrl,
    Guid CategoryId,
    string CategoryName,
    string? BrandName,
    decimal Price,
    decimal? DiscountPrice,
    bool IsDiscountActive,
    bool HasSizes,
    int TotalStock,
    bool IsActive,
    DateTime CreatedAt);

public sealed record AdminProductImageDto(Guid Id, string Url, string? ThumbnailUrl, bool IsPrimary, int SortOrder);
public sealed record AdminProductSizeDto(Guid Id, string Label, decimal Price, int Stock, bool InStock);

public sealed record AdminProductDetailsDto(
    Guid Id,
    string Title,
    string Slug,
    string Description,
    Guid CategoryId,
    string CategoryName,
    string CategorySlug,
    Guid? BrandId,
    BrandRefDto? Brand,
    decimal Price,
    decimal? DiscountPrice,
    DateTime? DiscountStartAt,
    DateTime? DiscountEndAt,
    bool IsDiscountActive,
    bool HasSizes,
    bool HasColors,
    int Stock,
    bool IsActive,
    IReadOnlyList<AdminProductImageDto> Images,
    IReadOnlyList<ProductColorDto> Colors,
    IReadOnlyList<AdminProductSizeDto> Sizes,
    IReadOnlyList<Guid> RelatedProductIds,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record ProductSizeInput(Guid? Id, string Label, decimal Price, int Stock);
public sealed record ProductColorInput(Guid? Id, string Name, string Hex);

public sealed record ProductInput(
    string Title,
    string Description,
    Guid CategoryId,
    Guid? BrandId,
    decimal Price,
    decimal? DiscountPrice,
    DateTime? DiscountStartAt,
    DateTime? DiscountEndAt,
    bool HasSizes,
    int Stock,
    IReadOnlyList<ProductSizeInput>? Sizes,
    IReadOnlyList<ProductColorInput>? Colors,
    IReadOnlyList<string>? ImageUrls,
    bool IsActive,
    string? Slug = null);

public enum ProductSort { Newest, BestSelling, PriceAsc, PriceDesc }

internal static class ProductProjections
{
    /// <summary>Server-side projection for list items (no entity materialisation, no N+1).</summary>
    public static Expression<Func<Product, ProductListItemDto>> ListItem(DateTime now) => p => new ProductListItemDto(
        p.Id,
        p.Title,
        p.Slug,
        p.Images.Where(i => i.IsPrimary).Select(i => i.Url).FirstOrDefault()
            ?? p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
        p.Price,
        p.DiscountPrice,
        p.DiscountPrice != null && p.DiscountPrice < p.Price
            && (p.DiscountStartAt == null || p.DiscountStartAt <= now)
            && (p.DiscountEndAt == null || p.DiscountEndAt >= now),
        p.HasSizes,
        p.HasColors,
        p.CategoryId,
        p.BrandId,
        p.Brand != null ? p.Brand.Name : null,
        p.Brand != null ? p.Brand.Slug : null);

    public static ProductSort ParseSort(string? sort) => sort?.ToLowerInvariant() switch
    {
        "bestselling" => ProductSort.BestSelling,
        "priceasc" => ProductSort.PriceAsc,
        "pricedesc" => ProductSort.PriceDesc,
        _ => ProductSort.Newest
    };

    public static IQueryable<Product> ApplySort(IQueryable<Product> query, ProductSort sort, DateTime now)
    {
        // Effective price expression (translated to SQL CASE); kept as an expression so it is composable.
        Expression<Func<Product, decimal>> effectivePrice = p =>
            p.DiscountPrice != null && p.DiscountPrice < p.Price
            && (p.DiscountStartAt == null || p.DiscountStartAt <= now)
            && (p.DiscountEndAt == null || p.DiscountEndAt >= now)
                ? p.DiscountPrice!.Value
                : p.Price;

        return sort switch
        {
            ProductSort.BestSelling => query
                .OrderByDescending(p => p.OrderItems.Where(oi => oi.Order.Status != Domain.Enums.OrderStatus.Fake).Sum(oi => (int?)oi.Quantity) ?? 0)
                .ThenByDescending(p => p.CreatedAt),
            ProductSort.PriceAsc => query.OrderBy(effectivePrice).ThenByDescending(p => p.CreatedAt),
            ProductSort.PriceDesc => query.OrderByDescending(effectivePrice).ThenByDescending(p => p.CreatedAt),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };
    }

    /// <summary>Derives the thumbnail URL for images produced by our own upload pipeline ({guid}.webp → {guid}_thumb.webp).</summary>
    public static string? DeriveThumbnailUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        var idx = url.LastIndexOf(".webp", StringComparison.OrdinalIgnoreCase);
        if (idx < 0 || url.Contains("_thumb.webp", StringComparison.OrdinalIgnoreCase)) return null;
        return url[..idx] + "_thumb.webp";
    }
}
