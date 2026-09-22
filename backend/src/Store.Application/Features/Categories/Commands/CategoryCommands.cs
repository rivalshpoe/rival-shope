using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using ValidationException = Store.Application.Common.Exceptions.ValidationException;
using Store.Application.Common.Interfaces;
using Store.Domain.Entities;
using Store.Domain.Rules;

namespace Store.Application.Features.Categories.Commands;

public sealed record CreateCategoryCommand(CategoryInput Input) : IRequest<CategoryDto>;
public sealed record UpdateCategoryCommand(Guid Id, CategoryInput Input) : IRequest<CategoryDto>;
public sealed record DeleteCategoryCommand(Guid Id) : IRequest;

public sealed class CategoryInputValidator : AbstractValidator<CategoryInput>
{
    public CategoryInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("اسم القسم مطلوب.").MaximumLength(120).WithMessage("اسم القسم طويل جدًا.");
        RuleFor(x => x.Slug).MaximumLength(150).WithMessage("المعرّف طويل جدًا.");
        RuleFor(x => x.ImageUrl).MaximumLength(1000).WithMessage("رابط الصورة طويل جدًا.");
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0).WithMessage("ترتيب العرض يجب أن يكون صفرًا أو أكثر.");
    }
}

public sealed class CreateCategoryCommandValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryCommandValidator() => RuleFor(x => x.Input).SetValidator(new CategoryInputValidator());
}

public sealed class UpdateCategoryCommandValidator : AbstractValidator<UpdateCategoryCommand>
{
    public UpdateCategoryCommandValidator() => RuleFor(x => x.Input).SetValidator(new CategoryInputValidator());
}

internal static class CategoryMapping
{
    public static CategoryDto ToDto(Category c, int productCount = 0) =>
        new(c.Id, c.Name, c.Slug, c.ImageUrl, c.ParentCategoryId, c.SortOrder, c.IsActive, productCount);

    public static async Task<string> UniqueSlugAsync(IApplicationDbContext db, string? requested, string name, Guid? excludeId, CancellationToken ct)
    {
        var baseSlug = SlugGenerator.Generate(string.IsNullOrWhiteSpace(requested) ? name : requested);
        var slug = baseSlug;
        var i = 2;
        while (await db.Categories.IgnoreQueryFilters().AnyAsync(c => c.Slug == slug && c.Id != excludeId, ct))
            slug = $"{baseSlug}-{i++}";
        return slug;
    }
}

public sealed class CreateCategoryCommandHandler : IRequestHandler<CreateCategoryCommand, CategoryDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;
    private readonly IAuditLogger _audit;
    private readonly IDateTimeProvider _clock;

    public CreateCategoryCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock)
    {
        _db = db; _cache = cache; _audit = audit; _clock = clock;
    }

    public async Task<CategoryDto> Handle(CreateCategoryCommand request, CancellationToken ct)
    {
        var input = request.Input;
        if (input.ParentId.HasValue && !await _db.Categories.AnyAsync(c => c.Id == input.ParentId.Value, ct))
            throw new ValidationException("parentId", "القسم الأب غير موجود.");

        var category = new Category
        {
            Name = input.Name.Trim(),
            Slug = await CategoryMapping.UniqueSlugAsync(_db, input.Slug, input.Name, null, ct),
            ImageUrl = input.ImageUrl,
            ParentCategoryId = input.ParentId,
            SortOrder = input.SortOrder,
            IsActive = input.IsActive,
            CreatedAt = _clock.UtcNow
        };
        _db.Categories.Add(category);
        _audit.Log("CategoryCreated", nameof(Category), category.Id, category.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.CategoriesAsync(_cache, ct);
        return CategoryMapping.ToDto(category);
    }
}

public sealed class UpdateCategoryCommandHandler : IRequestHandler<UpdateCategoryCommand, CategoryDto>
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;
    private readonly IAuditLogger _audit;
    private readonly IDateTimeProvider _clock;

    public UpdateCategoryCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock)
    {
        _db = db; _cache = cache; _audit = audit; _clock = clock;
    }

    public async Task<CategoryDto> Handle(UpdateCategoryCommand request, CancellationToken ct)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.Id, ct)
                       ?? throw new NotFoundException("القسم", request.Id);
        var input = request.Input;

        if (input.ParentId == request.Id)
            throw new ValidationException("parentId", "لا يمكن أن يكون القسم أبًا لنفسه.");
        if (input.ParentId.HasValue && !await _db.Categories.AnyAsync(c => c.Id == input.ParentId.Value, ct))
            throw new ValidationException("parentId", "القسم الأب غير موجود.");

        category.Name = input.Name.Trim();
        if (!string.IsNullOrWhiteSpace(input.Slug) && input.Slug != category.Slug)
            category.Slug = await CategoryMapping.UniqueSlugAsync(_db, input.Slug, input.Name, category.Id, ct);
        category.ImageUrl = input.ImageUrl;
        category.ParentCategoryId = input.ParentId;
        category.SortOrder = input.SortOrder;
        category.IsActive = input.IsActive;
        category.UpdatedAt = _clock.UtcNow;

        _audit.Log("CategoryUpdated", nameof(Category), category.Id, category.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.CategoriesAsync(_cache, ct);

        var count = await _db.Products.CountAsync(p => p.CategoryId == category.Id && p.IsActive, ct);
        return CategoryMapping.ToDto(category, count);
    }
}

public sealed class DeleteCategoryCommandHandler : IRequestHandler<DeleteCategoryCommand>
{
    private readonly IApplicationDbContext _db;
    private readonly ICacheService _cache;
    private readonly IAuditLogger _audit;
    private readonly IDateTimeProvider _clock;

    public DeleteCategoryCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock)
    {
        _db = db; _cache = cache; _audit = audit; _clock = clock;
    }

    public async Task Handle(DeleteCategoryCommand request, CancellationToken ct)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Id == request.Id, ct)
                       ?? throw new NotFoundException("القسم", request.Id);

        // Soft delete only — historical orders keep their product → category links.
        category.IsActive = false;
        category.IsDeleted = true;
        category.UpdatedAt = _clock.UtcNow;

        _audit.Log("CategoryDeleted", nameof(Category), category.Id, category.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.CategoriesAsync(_cache, ct);
    }
}
