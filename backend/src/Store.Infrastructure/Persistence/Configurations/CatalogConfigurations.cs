using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Store.Domain.Entities;

namespace Store.Infrastructure.Persistence.Configurations;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.ToTable("Categories");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Slug).HasMaxLength(150).IsRequired();
        b.Property(x => x.ImageUrl).HasMaxLength(1000);
        b.HasIndex(x => x.Slug).IsUnique();
        b.HasIndex(x => x.ParentCategoryId);
        b.HasIndex(x => new { x.IsActive, x.SortOrder });
        b.HasOne(x => x.ParentCategory).WithMany(x => x.Children).HasForeignKey(x => x.ParentCategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> b)
    {
        b.ToTable("Brands");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Slug).HasMaxLength(150).IsRequired();
        b.Property(x => x.ImageUrl).HasMaxLength(1000);
        b.HasIndex(x => x.Slug).IsUnique();
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.ToTable("Products", t =>
        {
            t.HasCheckConstraint("CK_Products_Price_Positive", "\"Price\" > 0");
            t.HasCheckConstraint("CK_Products_Stock_NonNegative", "\"Stock\" >= 0");
            t.HasCheckConstraint("CK_Products_DiscountPrice_Positive", "\"DiscountPrice\" IS NULL OR \"DiscountPrice\" > 0");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Slug).HasMaxLength(220).IsRequired();
        b.Property(x => x.Description).HasMaxLength(5000).IsRequired();
        b.Property(x => x.Price).HasPrecision(18, 2);
        b.Property(x => x.DiscountPrice).HasPrecision(18, 2);

        b.HasIndex(x => x.Slug).IsUnique();
        b.HasIndex(x => new { x.CategoryId, x.IsActive, x.CreatedAt });
        b.HasIndex(x => x.CreatedAt);
        b.HasIndex(x => x.BrandId);
        b.HasIndex(x => x.IsActive).HasFilter("\"IsActive\" = true").HasDatabaseName("IX_Products_IsActive_Partial");
        // pg_trgm GIN index for fast partial-text search on title + description.
        b.HasIndex(x => new { x.Title, x.Description })
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops", "gin_trgm_ops")
            .HasDatabaseName("IX_Products_Title_Description_Trgm");

        b.HasOne(x => x.Category).WithMany(x => x.Products).HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Brand).WithMany(x => x.Products).HasForeignKey(x => x.BrandId).OnDelete(DeleteBehavior.SetNull);
        b.HasMany(x => x.Images).WithOne(x => x.Product).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Colors).WithOne(x => x.Product).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Sizes).WithOne(x => x.Product).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> b)
    {
        b.ToTable("ProductImages");
        b.HasKey(x => x.Id);
        b.Property(x => x.Url).HasMaxLength(1000).IsRequired();
        b.Property(x => x.ThumbnailUrl).HasMaxLength(1000);
        b.HasIndex(x => new { x.ProductId, x.SortOrder });
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class ProductColorConfiguration : IEntityTypeConfiguration<ProductColor>
{
    public void Configure(EntityTypeBuilder<ProductColor> b)
    {
        b.ToTable("ProductColors");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(50).IsRequired();
        b.Property(x => x.HexCode).HasMaxLength(9).IsRequired();
        b.HasIndex(x => x.ProductId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class ProductSizeConfiguration : IEntityTypeConfiguration<ProductSize>
{
    public void Configure(EntityTypeBuilder<ProductSize> b)
    {
        b.ToTable("ProductSizes", t =>
        {
            t.HasCheckConstraint("CK_ProductSizes_Price_Positive", "\"Price\" > 0");
            t.HasCheckConstraint("CK_ProductSizes_Stock_NonNegative", "\"Stock\" >= 0");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Label).HasMaxLength(50).IsRequired();
        b.Property(x => x.Price).HasPrecision(18, 2);
        b.HasIndex(x => x.ProductId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> b)
    {
        b.ToTable("Reviews", t => t.HasCheckConstraint("CK_Reviews_Rating_Range", "\"Rating\" BETWEEN 1 AND 5"));
        b.HasKey(x => x.Id);
        b.Property(x => x.CustomerName).HasMaxLength(100).IsRequired();
        b.Property(x => x.Comment).HasMaxLength(2000).IsRequired();
        b.Property(x => x.ImageUrl).HasMaxLength(1000);
        b.HasIndex(x => new { x.ProductId, x.IsApproved, x.CreatedAt });
        b.HasIndex(x => x.IsApproved).HasFilter("\"IsApproved\" = true").HasDatabaseName("IX_Reviews_IsApproved_Partial");
        b.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.SetNull);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class PolicyConfiguration : IEntityTypeConfiguration<Policy>
{
    public void Configure(EntityTypeBuilder<Policy> b)
    {
        b.ToTable("Policies");
        b.HasKey(x => x.Id);
        b.Property(x => x.Key).HasMaxLength(30).IsRequired();
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Content).HasMaxLength(20000).IsRequired();
        b.HasIndex(x => x.Key).IsUnique();
    }
}
