using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using ValidationException = Store.Application.Common.Exceptions.ValidationException;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;
using Store.Domain.Entities;

namespace Store.Application.Features.Reviews;

public sealed record ReviewDto(Guid Id, string CustomerName, int Rating, string Comment, string? ImageUrl, Guid? ProductId, string? ProductTitle, DateTime CreatedAt, bool IsApproved);
public sealed record ReviewInput(string CustomerName, int Rating, string Comment, string? ImageUrl, Guid? ProductId, bool IsApproved);

public sealed record GetPublicReviewsQuery(Guid? ProductId, int? Page, int? PageSize) : IRequest<PagedResult<ReviewDto>>;
public sealed record GetAdminReviewsQuery(int? Page, int? PageSize, bool? ApprovedOnly) : IRequest<PagedResult<ReviewDto>>;
public sealed record CreateReviewCommand(ReviewInput Input) : IRequest<ReviewDto>;
public sealed record UpdateReviewCommand(Guid Id, ReviewInput Input) : IRequest<ReviewDto>;
public sealed record DeleteReviewCommand(Guid Id) : IRequest;
public sealed record ApproveReviewCommand(Guid Id, bool IsApproved) : IRequest<ReviewDto>;

public sealed class ReviewInputValidator : AbstractValidator<ReviewInput>
{
    public ReviewInputValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty().WithMessage("اسم العميل مطلوب.").MaximumLength(100).WithMessage("اسم العميل طويل جدًا.");
        RuleFor(x => x.Rating).InclusiveBetween(1, 5).WithMessage("التقييم بين 1 و5.");
        RuleFor(x => x.Comment).NotEmpty().WithMessage("نص التقييم مطلوب.").MaximumLength(2000).WithMessage("نص التقييم طويل جدًا.");
        RuleFor(x => x.ImageUrl).MaximumLength(1000).WithMessage("رابط الصورة طويل جدًا.");
    }
}
public sealed class CreateReviewCommandValidator : AbstractValidator<CreateReviewCommand>
{
    public CreateReviewCommandValidator() => RuleFor(x => x.Input).SetValidator(new ReviewInputValidator());
}
public sealed class UpdateReviewCommandValidator : AbstractValidator<UpdateReviewCommand>
{
    public UpdateReviewCommandValidator() => RuleFor(x => x.Input).SetValidator(new ReviewInputValidator());
}

internal static class ReviewQueries
{
    public static IQueryable<ReviewDto> Project(IQueryable<Review> q) => q.Select(r => new ReviewDto(
        r.Id, r.CustomerName, r.Rating, r.Comment, r.ImageUrl, r.ProductId,
        r.Product != null ? r.Product.Title : null, r.CreatedAt, r.IsApproved));

    public static async Task<ReviewDto> LoadDto(IApplicationDbContext db, Guid id, CancellationToken ct) =>
        await Project(db.Reviews.AsNoTracking().Where(r => r.Id == id)).FirstAsync(ct);

    public static async Task EnsureProduct(IApplicationDbContext db, Guid? productId, CancellationToken ct)
    {
        if (productId.HasValue && !await db.Products.AnyAsync(p => p.Id == productId.Value, ct))
            throw new ValidationException("productId", "المنتج غير موجود.");
    }
}

/// <summary>Approved reviews only — cached 5 min under <c>reviews:approved:{productId|all}:{page}:{pageSize}</c>.</summary>
public sealed class GetPublicReviewsQueryHandler : IRequestHandler<GetPublicReviewsQuery, PagedResult<ReviewDto>>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache;
    public GetPublicReviewsQueryHandler(IApplicationDbContext db, ICacheService cache) { _db = db; _cache = cache; }

    public Task<PagedResult<ReviewDto>> Handle(GetPublicReviewsQuery request, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(request.Page, request.PageSize);
        return _cache.GetOrSetAsync(CacheKeys.ReviewsApproved(request.ProductId, page, pageSize), CacheKeys.Ttl.Reviews, c =>
        {
            var q = _db.Reviews.AsNoTracking().Where(r => r.IsApproved);
            if (request.ProductId.HasValue) q = q.Where(r => r.ProductId == request.ProductId.Value);
            return ReviewQueries.Project(q.OrderByDescending(r => r.CreatedAt)).ToPagedResultAsync(page, pageSize, c);
        }, ct);
    }
}

public sealed class GetAdminReviewsQueryHandler : IRequestHandler<GetAdminReviewsQuery, PagedResult<ReviewDto>>
{
    private readonly IApplicationDbContext _db;
    public GetAdminReviewsQueryHandler(IApplicationDbContext db) => _db = db;

    public Task<PagedResult<ReviewDto>> Handle(GetAdminReviewsQuery request, CancellationToken ct)
    {
        var q = _db.Reviews.AsNoTracking();
        if (request.ApprovedOnly == true) q = q.Where(r => r.IsApproved);
        return ReviewQueries.Project(q.OrderByDescending(r => r.CreatedAt)).ToPagedResultAsync(request.Page, request.PageSize, ct);
    }
}

public sealed class CreateReviewCommandHandler : IRequestHandler<CreateReviewCommand, ReviewDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock; private readonly ICacheService _cache;
    public CreateReviewCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock, ICacheService cache) { _db = db; _audit = audit; _clock = clock; _cache = cache; }

    public async Task<ReviewDto> Handle(CreateReviewCommand request, CancellationToken ct)
    {
        await ReviewQueries.EnsureProduct(_db, request.Input.ProductId, ct);
        var r = new Review
        {
            CustomerName = request.Input.CustomerName.Trim(), Rating = request.Input.Rating, Comment = request.Input.Comment.Trim(),
            ImageUrl = request.Input.ImageUrl, ProductId = request.Input.ProductId, IsApproved = request.Input.IsApproved, CreatedAt = _clock.UtcNow
        };
        _db.Reviews.Add(r);
        _audit.Log("ReviewCreated", nameof(Review), r.Id);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ReviewsAsync(_cache, ct);
        return await ReviewQueries.LoadDto(_db, r.Id, ct);
    }
}

public sealed class UpdateReviewCommandHandler : IRequestHandler<UpdateReviewCommand, ReviewDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock; private readonly ICacheService _cache;
    public UpdateReviewCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock, ICacheService cache) { _db = db; _audit = audit; _clock = clock; _cache = cache; }

    public async Task<ReviewDto> Handle(UpdateReviewCommand request, CancellationToken ct)
    {
        var r = await _db.Reviews.FirstOrDefaultAsync(x => x.Id == request.Id, ct) ?? throw new NotFoundException("التقييم", request.Id);
        await ReviewQueries.EnsureProduct(_db, request.Input.ProductId, ct);
        r.CustomerName = request.Input.CustomerName.Trim();
        r.Rating = request.Input.Rating;
        r.Comment = request.Input.Comment.Trim();
        r.ImageUrl = request.Input.ImageUrl;
        r.ProductId = request.Input.ProductId;
        r.IsApproved = request.Input.IsApproved;
        r.UpdatedAt = _clock.UtcNow;
        _audit.Log("ReviewUpdated", nameof(Review), r.Id);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ReviewsAsync(_cache, ct);
        return await ReviewQueries.LoadDto(_db, r.Id, ct);
    }
}

public sealed class DeleteReviewCommandHandler : IRequestHandler<DeleteReviewCommand>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock; private readonly ICacheService _cache;
    public DeleteReviewCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock, ICacheService cache) { _db = db; _audit = audit; _clock = clock; _cache = cache; }

    public async Task Handle(DeleteReviewCommand request, CancellationToken ct)
    {
        var r = await _db.Reviews.FirstOrDefaultAsync(x => x.Id == request.Id, ct) ?? throw new NotFoundException("التقييم", request.Id);
        r.IsDeleted = true;
        r.IsApproved = false;
        r.UpdatedAt = _clock.UtcNow;
        _audit.Log("ReviewDeleted", nameof(Review), r.Id);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ReviewsAsync(_cache, ct);
    }
}

public sealed class ApproveReviewCommandHandler : IRequestHandler<ApproveReviewCommand, ReviewDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock; private readonly ICacheService _cache;
    public ApproveReviewCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock, ICacheService cache) { _db = db; _audit = audit; _clock = clock; _cache = cache; }

    public async Task<ReviewDto> Handle(ApproveReviewCommand request, CancellationToken ct)
    {
        var r = await _db.Reviews.FirstOrDefaultAsync(x => x.Id == request.Id, ct) ?? throw new NotFoundException("التقييم", request.Id);
        r.IsApproved = request.IsApproved;
        r.UpdatedAt = _clock.UtcNow;
        _audit.Log(request.IsApproved ? "ReviewApproved" : "ReviewUnapproved", nameof(Review), r.Id);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.ReviewsAsync(_cache, ct);
        return await ReviewQueries.LoadDto(_db, r.Id, ct);
    }
}
