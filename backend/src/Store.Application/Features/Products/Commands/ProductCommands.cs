using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using ValidationException = Store.Application.Common.Exceptions.ValidationException;
using Store.Application.Common.Interfaces;
using Store.Application.Features.Products.Queries;
using Store.Domain.Entities;
using Store.Domain.Rules;

namespace Store.Application.Features.Products.Commands;

public sealed record CreateProductCommand(ProductInput Input) : IRequest<AdminProductDetailsDto>;
public sealed record UpdateProductCommand(Guid Id, ProductInput Input) : IRequest<AdminProductDetailsDto>;
public sealed record DeleteProductCommand(Guid Id) : IRequest;

public sealed class ProductInputValidator : AbstractValidator<ProductInput>
{
    public ProductInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("عنوان المنتج مطلوب.").MaximumLength(200).WithMessage("عنوان المنتج طويل جدًا.");
        RuleFor(x => x.Description).MaximumLength(5000).WithMessage("الوصف طويل جدًا.");
        RuleFor(x => x.CategoryId).NotEmpty().WithMessage("القسم مطلوب.");
        RuleFor(x => x.Price).GreaterThan(0).WithMessage("السعر يجب أن يكون أكبر من صفر.");
        RuleFor(x => x.DiscountPrice).GreaterThan(0).When(x => x.DiscountPrice.HasValue).WithMessage("سعر الخصم يجب أن يكون أكبر من صفر.")
            .LessThan(x => x.Price).When(x => x.DiscountPrice.HasValue).WithMessage("سعر الخصم يجب أن يكون أقل من السعر الأساسي.");
        RuleFor(x => x.DiscountEndAt).GreaterThan(x => x.DiscountStartAt!.Value)
            .When(x => x.DiscountStartAt.HasValue && x.DiscountEndAt.HasValue)
            .WithMessage("تاريخ انتهاء الخصم يجب أن يكون بعد تاريخ البداية.");
        RuleFor(x => x.Stock).GreaterThanOrEqualTo(0).WithMessage("المخزون لا يمكن أن يكون سالبًا.");
        RuleFor(x => x.Sizes).NotEmpty().When(x => x.HasSizes).WithMessage("يجب إضافة مقاس واحد على الأقل عند تفعيل المقاسات.");
        RuleForEach(x => x.Sizes).ChildRules(s =>
        {
            s.RuleFor(z => z.Label).NotEmpty().WithMessage("اسم المقاس مطلوب.").MaximumLength(50).WithMessage("اسم المقاس طويل جدًا.");
            s.RuleFor(z => z.Price).GreaterThan(0).WithMessage("سعر المقاس يجب أن يكون أكبر من صفر.");
            s.RuleFor(z => z.Stock).GreaterThanOrEqualTo(0).WithMessage("مخزون المقاس لا يمكن أن يكون سالبًا.");
        });
        RuleForEach(x => x.Colors).ChildRules(c =>
        {
            c.RuleFor(z => z.Name).NotEmpty().WithMessage("اسم اللون مطلوب.").MaximumLength(50).WithMessage("اسم اللون طويل جدًا.");
            c.RuleFor(z => z.Hex).NotEmpty().WithMessage("كود اللون مطلوب.").Matches("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$").WithMessage("كود اللون غير صالح (مثال: #A1B2C3).");
        });
        RuleFor(x => x.ImageUrls).Must(l => l is null || l.Count <= 12).WithMessage("الحد الأقصى 12 صورة لكل منتج.");
        RuleForEach(x => x.ImageUrls).NotEmpty().MaximumLength(1000).WithMessage("رابط الصورة غير صالح.");
    }
}

public sealed class CreateProductCommandValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductCommandValidator() => RuleFor(x => x.Input).SetValidator(new ProductInputValidator());
}
public sealed class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator() => RuleFor(x => x.Input).SetValidator(new ProductInputValidator());
}

internal static class ProductWriteHelpers
{
    public static async Task<string> UniqueSlugAsync(IApplicationDbContext db, string? requested, string title, Guid? excludeId, CancellationToken ct)
    {
        var baseSlug = SlugGenerator.Generate(string.IsNullOrWhiteSpace(requested) ? title : requested);
        var slug = baseSlug;
        var i = 2;
        while (await db.Products.IgnoreQueryFilters().AnyAsync(p => p.Slug == slug && p.Id != excludeId, ct))
            slug = $"{baseSlug}-{i++}";
        return slug;
    }

    public static async Task ValidateReferencesAsync(IApplicationDbContext db, ProductInput input, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId, ct))
            throw new ValidationException("categoryId", "القسم غير موجود.");
        if (input.BrandId.HasValue && !await db.Brands.AnyAsync(b => b.Id == input.BrandId.Value, ct))
            throw new ValidationException("brandId", "الماركة غير موجودة.");
    }

    public static void ApplyScalars(Product p, ProductInput input, DateTime now)
    {
        p.Title = input.Title.Trim();
        p.Description = input.Description?.Trim() ?? string.Empty;
        p.CategoryId = input.CategoryId;
        p.BrandId = input.BrandId;
        p.Price = input.Price;
        p.DiscountPrice = input.DiscountPrice;
        p.DiscountStartAt = input.DiscountStartAt;
        p.DiscountEndAt = input.DiscountEndAt;
        p.HasSizes = input.HasSizes;
        p.HasColors = input.Colors is { Count: > 0 };
        p.Stock = input.HasSizes ? 0 : input.Stock;
        p.IsActive = input.IsActive;
        p.UpdatedAt = now;
    }

    /// <summary>Replaces the image set. The first URL becomes the primary image (same transaction).</summary>
    public static void SyncImages(Product p, IReadOnlyList<string>? urls, DateTime now)
    {
        var wanted = (urls ?? Array.Empty<string>()).Where(u => !string.IsNullOrWhiteSpace(u)).Select(u => u.Trim()).Distinct().ToList();
        var existing = p.Images.ToList();

        foreach (var img in existing.Where(i => !wanted.Contains(i.Url)))
            p.Images.Remove(img);

        for (var i = 0; i < wanted.Count; i++)
        {
            var url = wanted[i];
            var img = p.Images.FirstOrDefault(x => x.Url == url);
            if (img is null)
            {
                img = new ProductImage { ProductId = p.Id, Url = url, ThumbnailUrl = ProductProjections.DeriveThumbnailUrl(url), CreatedAt = now };
                p.Images.Add(img);
            }
            img.SortOrder = i;
            img.IsPrimary = i == 0;
            img.UpdatedAt = now;
        }
    }

    /// <summary>Upserts sizes by Id; removes sizes not present. Stock changes here are administrative (no inventory log).</summary>
    public static void SyncSizes(Product p, IReadOnlyList<ProductSizeInput>? sizes, DateTime now)
    {
        var wanted = p.HasSizes ? (sizes ?? Array.Empty<ProductSizeInput>()) : Array.Empty<ProductSizeInput>();
        var keepIds = wanted.Where(s => s.Id.HasValue).Select(s => s.Id!.Value).ToHashSet();

        foreach (var s in p.Sizes.Where(s => !keepIds.Contains(s.Id)).ToList())
        {
            s.IsDeleted = true; // soft delete keeps historical OrderItem.ProductSizeId links intact
            s.UpdatedAt = now;
        }

        foreach (var input in wanted)
        {
            var size = input.Id.HasValue ? p.Sizes.FirstOrDefault(s => s.Id == input.Id.Value) : null;
            if (size is null)
            {
                size = new ProductSize { ProductId = p.Id, CreatedAt = now };
                p.Sizes.Add(size);
            }
            size.Label = input.Label.Trim();
            size.Price = input.Price;
            size.Stock = input.Stock;
            size.IsDeleted = false;
            size.UpdatedAt = now;
        }
    }

    public static void SyncColors(Product p, IReadOnlyList<ProductColorInput>? colors, DateTime now)
    {
        var wanted = colors ?? Array.Empty<ProductColorInput>();
        var keepIds = wanted.Where(c => c.Id.HasValue).Select(c => c.Id!.Value).ToHashSet();

        foreach (var c in p.Colors.Where(c => !keepIds.Contains(c.Id)).ToList())
        {
            c.IsDeleted = true;
            c.UpdatedAt = now;
        }

        foreach (var input in wanted)
        {
            var color = input.Id.HasValue ? p.Colors.FirstOrDefault(c => c.Id == input.Id.Value) : null;
            if (color is null)
            {
                color = new ProductColor { ProductId = p.Id, CreatedAt = now };
                p.Colors.Add(color);
            }
            color.Name = input.Name.Trim();
            color.HexCode = input.Hex.Trim().ToUpperInvariant();
            color.IsDeleted = false;
            color.UpdatedAt = now;
        }
    }
}

public sealed class CreateProductCommandHandler : IRequestHandler<CreateProductCommand, AdminProductDetailsDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public CreateProductCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<AdminProductDetailsDto> Handle(CreateProductCommand request, CancellationToken ct)
    {
        var input = request.Input;
        await ProductWriteHelpers.ValidateReferencesAsync(_db, input, ct);
        var now = _clock.UtcNow;

        var product = new Product { CreatedAt = now };
        ProductWriteHelpers.ApplyScalars(product, input, now);
        product.UpdatedAt = null;
        product.Slug = await ProductWriteHelpers.UniqueSlugAsync(_db, input.Slug, input.Title, null, ct);
        ProductWriteHelpers.SyncImages(product, input.ImageUrls, now);
        ProductWriteHelpers.SyncSizes(product, input.Sizes, now);
        ProductWriteHelpers.SyncColors(product, input.Colors, now);

        _db.Products.Add(product);

        // Initial stock is recorded as a Restock so the inventory timeline starts from a known state.
        if (product.HasSizes)
        {
            foreach (var s in product.Sizes.Where(s => s.Stock > 0))
                _db.InventoryLogs.Add(new InventoryLog { ProductId = product.Id, ProductSizeId = s.Id, ChangeType = Domain.Enums.InventoryChangeType.Restock, QuantityChanged = s.Stock, StockAfter = s.Stock, Note = "مخزون أولي", CreatedAt = now });
        }
        else if (product.Stock > 0)
        {
            _db.InventoryLogs.Add(new InventoryLog { ProductId = product.Id, ChangeType = Domain.Enums.InventoryChangeType.Restock, QuantityChanged = product.Stock, StockAfter = product.Stock, Note = "مخزون أولي", CreatedAt = now });
        }

        _audit.Log("ProductCreated", nameof(Product), product.Id, product.Title);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ProductAsync(_cache, product.Id, ct);

        return await Reload(product.Id, ct);
    }

    private async Task<AdminProductDetailsDto> Reload(Guid id, CancellationToken ct)
    {
        var p = await _db.Products.AsNoTracking().Include(x => x.Category).Include(x => x.Brand)
            .Include(x => x.Images).Include(x => x.Colors).Include(x => x.Sizes).FirstAsync(x => x.Id == id, ct);
        return AdminProductMapping.ToDetails(p, Array.Empty<Guid>(), _clock.UtcNow);
    }
}

public sealed class UpdateProductCommandHandler : IRequestHandler<UpdateProductCommand, AdminProductDetailsDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public UpdateProductCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<AdminProductDetailsDto> Handle(UpdateProductCommand request, CancellationToken ct)
    {
        var input = request.Input;
        var product = await _db.Products
            .Include(p => p.Images).Include(p => p.Colors).Include(p => p.Sizes)
            .FirstOrDefaultAsync(p => p.Id == request.Id, ct)
            ?? throw new NotFoundException("المنتج", request.Id);

        await ProductWriteHelpers.ValidateReferencesAsync(_db, input, ct);
        var now = _clock.UtcNow;

        ProductWriteHelpers.ApplyScalars(product, input, now);
        if (!string.IsNullOrWhiteSpace(input.Slug) && input.Slug != product.Slug)
            product.Slug = await ProductWriteHelpers.UniqueSlugAsync(_db, input.Slug, input.Title, product.Id, ct);
        ProductWriteHelpers.SyncImages(product, input.ImageUrls, now);
        ProductWriteHelpers.SyncSizes(product, input.Sizes, now);
        ProductWriteHelpers.SyncColors(product, input.Colors, now);

        _audit.Log("ProductUpdated", nameof(Product), product.Id, product.Title);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ProductAsync(_cache, product.Id, ct);

        var reloaded = await _db.Products.AsNoTracking().Include(x => x.Category).Include(x => x.Brand)
            .Include(x => x.Images).Include(x => x.Colors).Include(x => x.Sizes).FirstAsync(x => x.Id == product.Id, ct);
        return AdminProductMapping.ToDetails(reloaded, Array.Empty<Guid>(), now);
    }
}

public sealed class DeleteProductCommandHandler : IRequestHandler<DeleteProductCommand>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public DeleteProductCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task Handle(DeleteProductCommand request, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == request.Id, ct) ?? throw new NotFoundException("المنتج", request.Id);
        // Soft delete only: OrderItem.ProductId links must survive (spec §8).
        product.IsActive = false;
        product.IsDeleted = true;
        product.UpdatedAt = _clock.UtcNow;
        _audit.Log("ProductDeleted", nameof(Product), product.Id, product.Title);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ProductAsync(_cache, product.Id, ct);
    }
}
