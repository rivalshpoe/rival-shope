using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using ValidationException = Store.Application.Common.Exceptions.ValidationException;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;
using Store.Domain.Entities;
using Store.Domain.Enums;

namespace Store.Application.Features.Inventory;

public sealed record InventoryRowDto(Guid ProductId, string ProductTitle, string? PrimaryImageUrl, Guid? SizeId, string? SizeLabel, int Stock, bool IsLow, bool IsDepleted, DateTime? LastChangeAt);
public sealed record RestockResultDto(Guid ProductId, Guid? SizeId, int Stock);
public sealed record InventoryLogDto(Guid Id, InventoryChangeType ChangeType, int QuantityChanged, int StockAfter, string? Note, DateTime CreatedAt, Guid? SizeId, string? SizeLabel);

public sealed record GetInventoryQuery(bool LowStockOnly, int? Threshold, int? Page, int? PageSize) : IRequest<PagedResult<InventoryRowDto>>;
public sealed record RestockCommand(Guid ProductId, Guid? SizeId, int Quantity, string? Note) : IRequest<RestockResultDto>;
public sealed record GetInventoryHistoryQuery(Guid ProductId, Guid? SizeId, int? Page, int? PageSize) : IRequest<PagedResult<InventoryLogDto>>;

public static class InventoryRules
{
    public const int DefaultLowStockThreshold = 5;
}

public sealed class RestockCommandValidator : AbstractValidator<RestockCommand>
{
    public RestockCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty().WithMessage("المنتج مطلوب.");
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("الكمية يجب أن تكون أكبر من صفر.").LessThanOrEqualTo(100_000).WithMessage("الكمية كبيرة جدًا.");
        RuleFor(x => x.Note).MaximumLength(300).WithMessage("الملاحظة طويلة جدًا.");
    }
}

public sealed class GetInventoryQueryHandler : IRequestHandler<GetInventoryQuery, PagedResult<InventoryRowDto>>
{
    private readonly IApplicationDbContext _db;
    public GetInventoryQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<PagedResult<InventoryRowDto>> Handle(GetInventoryQuery request, CancellationToken ct)
    {
        var threshold = request.Threshold is > 0 ? request.Threshold.Value : InventoryRules.DefaultLowStockThreshold;

        // Two set-based queries (product-level stock + size-level stock) merged in memory; the catalogue is small enough
        // and this keeps the SQL simple and index-friendly. Threshold is applied dynamically (no stored flag).
        var productRows = await _db.Products.AsNoTracking()
            .Where(p => !p.HasSizes)
            .Select(p => new InventoryRowDto(
                p.Id, p.Title,
                p.Images.Where(i => i.IsPrimary).Select(i => i.Url).FirstOrDefault() ?? p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                null, null, p.Stock, p.Stock < threshold, p.Stock <= 0,
                p.InventoryLogs.Where(l => l.ProductSizeId == null).Max(l => (DateTime?)l.CreatedAt)))
            .ToListAsync(ct);

        var sizeRows = await _db.ProductSizes.AsNoTracking()
            .Where(s => s.Product.HasSizes)
            .Select(s => new InventoryRowDto(
                s.ProductId, s.Product.Title,
                s.Product.Images.Where(i => i.IsPrimary).Select(i => i.Url).FirstOrDefault() ?? s.Product.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                s.Id, s.Label, s.Stock, s.Stock < threshold, s.Stock <= 0,
                s.Product.InventoryLogs.Where(l => l.ProductSizeId == s.Id).Max(l => (DateTime?)l.CreatedAt)))
            .ToListAsync(ct);

        IEnumerable<InventoryRowDto> all = productRows.Concat(sizeRows);
        if (request.LowStockOnly) all = all.Where(r => r.IsLow);

        var ordered = all.OrderBy(r => r.Stock).ThenBy(r => r.ProductTitle).ThenBy(r => r.SizeLabel).ToList();
        return ordered.ToPagedResult(request.Page, request.PageSize);
    }
}

public sealed class RestockCommandHandler : IRequestHandler<RestockCommand, RestockResultDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public RestockCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<RestockResultDto> Handle(RestockCommand request, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId, ct) ?? throw new NotFoundException("المنتج", request.ProductId);

        int stockAfter;
        if (product.HasSizes)
        {
            if (!request.SizeId.HasValue) throw new ValidationException("sizeId", "هذا المنتج يعتمد على المقاسات، يرجى تحديد المقاس.");
            var size = await _db.ProductSizes.FirstOrDefaultAsync(s => s.Id == request.SizeId.Value && s.ProductId == product.Id, ct)
                       ?? throw new NotFoundException("المقاس", request.SizeId.Value);
            size.Stock += request.Quantity;
            size.UpdatedAt = now;
            stockAfter = size.Stock;
        }
        else
        {
            if (request.SizeId.HasValue) throw new ValidationException("sizeId", "هذا المنتج لا يعتمد على المقاسات.");
            product.Stock += request.Quantity;
            product.UpdatedAt = now;
            stockAfter = product.Stock;
        }

        _db.InventoryLogs.Add(new InventoryLog
        {
            ProductId = product.Id, ProductSizeId = request.SizeId, ChangeType = InventoryChangeType.Restock,
            QuantityChanged = request.Quantity, StockAfter = stockAfter, Note = request.Note?.Trim(), CreatedAt = now
        });
        _audit.Log("InventoryRestocked", nameof(Product), product.Id, $"+{request.Quantity} (size: {request.SizeId?.ToString() ?? "-"})");
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ProductAsync(_cache, product.Id, ct);
        return new RestockResultDto(product.Id, request.SizeId, stockAfter);
    }
}

public sealed class GetInventoryHistoryQueryHandler : IRequestHandler<GetInventoryHistoryQuery, PagedResult<InventoryLogDto>>
{
    private readonly IApplicationDbContext _db;
    public GetInventoryHistoryQueryHandler(IApplicationDbContext db) => _db = db;

    public async Task<PagedResult<InventoryLogDto>> Handle(GetInventoryHistoryQuery request, CancellationToken ct)
    {
        if (!await _db.Products.IgnoreQueryFilters().AnyAsync(p => p.Id == request.ProductId, ct))
            throw new NotFoundException("المنتج", request.ProductId);

        var q = _db.InventoryLogs.AsNoTracking().Where(l => l.ProductId == request.ProductId);
        if (request.SizeId.HasValue) q = q.Where(l => l.ProductSizeId == request.SizeId.Value);

        return await q.OrderByDescending(l => l.CreatedAt)
            .Select(l => new InventoryLogDto(l.Id, l.ChangeType, l.QuantityChanged, l.StockAfter, l.Note, l.CreatedAt, l.ProductSizeId,
                l.ProductSize != null ? l.ProductSize.Label : null))
            .ToPagedResultAsync(request.Page, request.PageSize, ct);
    }
}
