namespace Store.Application.Features.Categories;

public sealed record CategoryDto(
    Guid Id,
    string Name,
    string Slug,
    string? ImageUrl,
    Guid? ParentId,
    int SortOrder,
    bool IsActive,
    int ProductCount);

public sealed record CategoryInput(
    string Name,
    string? Slug,
    string? ImageUrl,
    Guid? ParentId,
    int SortOrder,
    bool IsActive);
