using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Domain.Entities;
using Store.Domain.Rules;

namespace Store.Application.Features.Brands;

public sealed record BrandDto(Guid Id, string Name, string Slug, string? ImageUrl);
public sealed record BrandInput(string Name, string? Slug, string? ImageUrl);

public sealed record GetBrandsQuery(bool BypassCache = false) : IRequest<IReadOnlyList<BrandDto>>;
public sealed record CreateBrandCommand(BrandInput Input) : IRequest<BrandDto>;
public sealed record UpdateBrandCommand(Guid Id, BrandInput Input) : IRequest<BrandDto>;
public sealed record DeleteBrandCommand(Guid Id) : IRequest;

public sealed class BrandInputValidator : AbstractValidator<BrandInput>
{
    public BrandInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("اسم الماركة مطلوب.").MaximumLength(120).WithMessage("اسم الماركة طويل جدًا.");
        RuleFor(x => x.Slug).MaximumLength(150).WithMessage("المعرّف طويل جدًا.");
        RuleFor(x => x.ImageUrl).MaximumLength(1000).WithMessage("رابط الصورة طويل جدًا.");
    }
}
public sealed class CreateBrandCommandValidator : AbstractValidator<CreateBrandCommand>
{
    public CreateBrandCommandValidator() => RuleFor(x => x.Input).SetValidator(new BrandInputValidator());
}
public sealed class UpdateBrandCommandValidator : AbstractValidator<UpdateBrandCommand>
{
    public UpdateBrandCommandValidator() => RuleFor(x => x.Input).SetValidator(new BrandInputValidator());
}

internal static class BrandMapping
{
    public static BrandDto ToDto(Brand b) => new(b.Id, b.Name, b.Slug, b.ImageUrl);

    public static async Task<string> UniqueSlugAsync(IApplicationDbContext db, string? requested, string name, Guid? excludeId, CancellationToken ct)
    {
        var baseSlug = SlugGenerator.Generate(string.IsNullOrWhiteSpace(requested) ? name : requested);
        var slug = baseSlug;
        var i = 2;
        while (await db.Brands.IgnoreQueryFilters().AnyAsync(b => b.Slug == slug && b.Id != excludeId, ct))
            slug = $"{baseSlug}-{i++}";
        return slug;
    }
}

public sealed class GetBrandsQueryHandler : IRequestHandler<GetBrandsQuery, IReadOnlyList<BrandDto>>
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;
    public GetBrandsQueryHandler(IApplicationDbContext db, ICacheService cache) { _db = db; _cache = cache; }

    public Task<IReadOnlyList<BrandDto>> Handle(GetBrandsQuery request, CancellationToken ct)
    {
        if (request.BypassCache) return Load(ct);
        return _cache.GetOrSetAsync(CacheKeys.BrandsAll, CacheKeys.Ttl.Brands, Load, ct);
    }

    private async Task<IReadOnlyList<BrandDto>> Load(CancellationToken ct) =>
        await _db.Brands.AsNoTracking().OrderBy(b => b.Name)
            .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.ImageUrl)).ToListAsync(ct);
}

public sealed class CreateBrandCommandHandler : IRequestHandler<CreateBrandCommand, BrandDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public CreateBrandCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<BrandDto> Handle(CreateBrandCommand request, CancellationToken ct)
    {
        var brand = new Brand
        {
            Name = request.Input.Name.Trim(),
            Slug = await BrandMapping.UniqueSlugAsync(_db, request.Input.Slug, request.Input.Name, null, ct),
            ImageUrl = request.Input.ImageUrl,
            CreatedAt = _clock.UtcNow
        };
        _db.Brands.Add(brand);
        _audit.Log("BrandCreated", nameof(Brand), brand.Id, brand.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.BrandsAsync(_cache, ct);
        return BrandMapping.ToDto(brand);
    }
}

public sealed class UpdateBrandCommandHandler : IRequestHandler<UpdateBrandCommand, BrandDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public UpdateBrandCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<BrandDto> Handle(UpdateBrandCommand request, CancellationToken ct)
    {
        var brand = await _db.Brands.FirstOrDefaultAsync(b => b.Id == request.Id, ct) ?? throw new NotFoundException("الماركة", request.Id);
        brand.Name = request.Input.Name.Trim();
        if (!string.IsNullOrWhiteSpace(request.Input.Slug) && request.Input.Slug != brand.Slug)
            brand.Slug = await BrandMapping.UniqueSlugAsync(_db, request.Input.Slug, request.Input.Name, brand.Id, ct);
        brand.ImageUrl = request.Input.ImageUrl;
        brand.UpdatedAt = _clock.UtcNow;
        _audit.Log("BrandUpdated", nameof(Brand), brand.Id, brand.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.BrandsAsync(_cache, ct);
        return BrandMapping.ToDto(brand);
    }
}

public sealed class DeleteBrandCommandHandler : IRequestHandler<DeleteBrandCommand>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public DeleteBrandCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task Handle(DeleteBrandCommand request, CancellationToken ct)
    {
        var brand = await _db.Brands.FirstOrDefaultAsync(b => b.Id == request.Id, ct) ?? throw new NotFoundException("الماركة", request.Id);
        brand.IsDeleted = true;
        brand.UpdatedAt = _clock.UtcNow;
        _audit.Log("BrandDeleted", nameof(Brand), brand.Id, brand.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.BrandsAsync(_cache, ct);
    }
}
