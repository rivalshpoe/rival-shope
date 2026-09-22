using System.Security.Cryptography;
using System.Text;

namespace Store.Application.Common.Caching;

/// <summary>Cache keys and TTLs (spec §13 + contract addendum). Every admin write handler calls the matching invalidation.</summary>
public static class CacheKeys
{
    public const string CategoriesAll = "categories:all";
    public const string BrandsAll = "brands:all";
    public const string DeliveryZonesActive = "delivery-zones:active";
    public const string PoliciesAll = "policies:all";
    public const string PoliciesPrefix = "policies:";
    public const string ProductsListPrefix = "products:list:";
    public const string ProductDetailPrefix = "products:detail:";
    public const string SearchPrefix = "search:";
    public const string ReviewsApprovedPrefix = "reviews:approved:";

    public static string Policy(string key) => $"{PoliciesPrefix}{key}";
    public static string ProductDetail(Guid id) => $"{ProductDetailPrefix}{id}";
    public static string ProductsList(string filterSignature) => $"{ProductsListPrefix}{filterSignature}";

    /// <summary><c>search:{hash}</c> — the query text never becomes part of a key (length/charset/PII-safe).</summary>
    public static string Search(string q, int page, int pageSize) => $"{SearchPrefix}{Hash($"{q.Trim().ToLowerInvariant()}|{page}|{pageSize}")}";

    public static string ReviewsApproved(Guid? productId, int page, int pageSize) => $"{ReviewsApprovedPrefix}{productId?.ToString() ?? "all"}:{page}:{pageSize}";

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)))[..32].ToLowerInvariant();

    public static class Ttl
    {
        public static readonly TimeSpan Categories = TimeSpan.FromMinutes(10);
        public static readonly TimeSpan Brands = TimeSpan.FromMinutes(10);
        public static readonly TimeSpan ProductsList = TimeSpan.FromMinutes(5);
        public static readonly TimeSpan ProductDetail = TimeSpan.FromMinutes(2);
        public static readonly TimeSpan DeliveryZones = TimeSpan.FromMinutes(10);
        public static readonly TimeSpan Search = TimeSpan.FromMinutes(1);
        public static readonly TimeSpan Policies = TimeSpan.FromMinutes(10);
        public static readonly TimeSpan Reviews = TimeSpan.FromMinutes(5);
    }
}

/// <summary>Convenience invalidation helpers so handlers stay one-liners. Each admin write maps to exactly one of these.</summary>
public static class CacheInvalidation
{
    /// <summary>Category CRUD: category list, product lists (filters/counts) and product details (categoryName/slug).</summary>
    public static Task CategoriesAsync(Interfaces.ICacheService cache, CancellationToken ct) =>
        Task.WhenAll(
            cache.RemoveAsync(CacheKeys.CategoriesAll, ct),
            cache.RemoveByPrefixAsync(CacheKeys.ProductsListPrefix, ct),
            cache.RemoveByPrefixAsync(CacheKeys.ProductDetailPrefix, ct),
            cache.RemoveByPrefixAsync(CacheKeys.SearchPrefix, ct));

    /// <summary>Brand CRUD: brand list, product lists (brandName) and product details (brand block).</summary>
    public static Task BrandsAsync(Interfaces.ICacheService cache, CancellationToken ct) =>
        Task.WhenAll(
            cache.RemoveAsync(CacheKeys.BrandsAll, ct),
            cache.RemoveByPrefixAsync(CacheKeys.ProductsListPrefix, ct),
            cache.RemoveByPrefixAsync(CacheKeys.ProductDetailPrefix, ct),
            cache.RemoveByPrefixAsync(CacheKeys.SearchPrefix, ct));

    /// <summary>Product CRUD, sizes/colors/images, restock, sale and stock return: detail, every list page, search results and category counts.</summary>
    public static Task ProductAsync(Interfaces.ICacheService cache, Guid productId, CancellationToken ct) =>
        Task.WhenAll(
            cache.RemoveAsync(CacheKeys.ProductDetail(productId), ct),
            cache.RemoveByPrefixAsync(CacheKeys.ProductsListPrefix, ct),
            cache.RemoveByPrefixAsync(CacheKeys.SearchPrefix, ct),
            cache.RemoveByPrefixAsync(CacheKeys.ReviewsApprovedPrefix, ct), // reviews embed productTitle
            cache.RemoveAsync(CacheKeys.CategoriesAll, ct));

    public static Task DeliveryZonesAsync(Interfaces.ICacheService cache, CancellationToken ct) =>
        cache.RemoveAsync(CacheKeys.DeliveryZonesActive, ct);

    public static Task PoliciesAsync(Interfaces.ICacheService cache, string key, CancellationToken ct) =>
        Task.WhenAll(cache.RemoveAsync(CacheKeys.PoliciesAll, ct), cache.RemoveAsync(CacheKeys.Policy(key), ct));

    /// <summary>Review create/update/delete/approve: every approved-reviews page (global and per product).</summary>
    public static Task ReviewsAsync(Interfaces.ICacheService cache, CancellationToken ct) =>
        cache.RemoveByPrefixAsync(CacheKeys.ReviewsApprovedPrefix, ct);
}
