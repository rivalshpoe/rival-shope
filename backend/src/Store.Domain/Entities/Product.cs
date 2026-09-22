using Store.Domain.Common;

namespace Store.Domain.Entities;

public class Product : AuditableEntity
{
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public Guid? BrandId { get; set; }
    public Brand? Brand { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? DiscountPrice { get; set; }
    public DateTime? DiscountStartAt { get; set; }
    public DateTime? DiscountEndAt { get; set; }
    public bool HasSizes { get; set; }
    public bool HasColors { get; set; }
    /// <summary>Only used when <see cref="HasSizes"/> is false; otherwise stock lives per <see cref="ProductSize"/>.</summary>
    public int Stock { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
    public ICollection<ProductColor> Colors { get; set; } = new List<ProductColor>();
    public ICollection<ProductSize> Sizes { get; set; } = new List<ProductSize>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public ICollection<InventoryLog> InventoryLogs { get; set; } = new List<InventoryLog>();

    public bool IsDiscountActive(DateTime utcNow) =>
        DiscountPrice.HasValue
        && DiscountPrice.Value < Price
        && (!DiscountStartAt.HasValue || DiscountStartAt.Value <= utcNow)
        && (!DiscountEndAt.HasValue || DiscountEndAt.Value >= utcNow);

    public decimal EffectivePrice(DateTime utcNow) => IsDiscountActive(utcNow) ? DiscountPrice!.Value : Price;
}

public class ProductImage : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Url { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public int SortOrder { get; set; }
    public bool IsPrimary { get; set; }
}

public class ProductColor : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string HexCode { get; set; } = "#000000";
}

public class ProductSize : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public string Label { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Stock { get; set; }
}
