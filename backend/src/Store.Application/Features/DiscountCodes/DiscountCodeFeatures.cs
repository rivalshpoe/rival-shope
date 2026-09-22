using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Domain.Entities;
using Store.Domain.Rules;

namespace Store.Application.Features.DiscountCodes;

public sealed record DiscountCodeDto(Guid Id, string Code, int PercentageOff, DateTime StartAt, DateTime EndAt, bool IsActive, int UsageCount, bool IsCurrentlyValid);
public sealed record DiscountCodeInput(string Code, int PercentageOff, DateTime StartAt, DateTime EndAt, bool IsActive);
public sealed record ValidateDiscountResult(bool IsValid, decimal? DiscountAmount);

/// <summary>Public validation — never increments UsageCount (spec §9).</summary>
public sealed record ValidateDiscountCodeCommand(string? Code, decimal Subtotal) : IRequest<ValidateDiscountResult>;
public sealed record GetDiscountCodesQuery() : IRequest<IReadOnlyList<DiscountCodeDto>>;
public sealed record CreateDiscountCodeCommand(DiscountCodeInput Input) : IRequest<DiscountCodeDto>;
public sealed record UpdateDiscountCodeCommand(Guid Id, DiscountCodeInput Input) : IRequest<DiscountCodeDto>;
public sealed record DeleteDiscountCodeCommand(Guid Id) : IRequest;

public sealed class ValidateDiscountCodeCommandValidator : AbstractValidator<ValidateDiscountCodeCommand>
{
    public ValidateDiscountCodeCommandValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("كود الخصم مطلوب.").MaximumLength(50).WithMessage("كود الخصم طويل جدًا.");
        RuleFor(x => x.Subtotal).GreaterThanOrEqualTo(0).WithMessage("المجموع غير صالح.");
    }
}

public sealed class DiscountCodeInputValidator : AbstractValidator<DiscountCodeInput>
{
    public DiscountCodeInputValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("الكود مطلوب.").MaximumLength(50).WithMessage("الكود طويل جدًا.")
            .Matches("^[A-Za-z0-9_-]+$").WithMessage("الكود يجب أن يحتوي على أحرف لاتينية وأرقام فقط.");
        RuleFor(x => x.PercentageOff).InclusiveBetween(1, 100).WithMessage("نسبة الخصم بين 1 و100.");
        RuleFor(x => x.EndAt).GreaterThan(x => x.StartAt).WithMessage("تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.");
    }
}
public sealed class CreateDiscountCodeCommandValidator : AbstractValidator<CreateDiscountCodeCommand>
{
    public CreateDiscountCodeCommandValidator() => RuleFor(x => x.Input).SetValidator(new DiscountCodeInputValidator());
}
public sealed class UpdateDiscountCodeCommandValidator : AbstractValidator<UpdateDiscountCodeCommand>
{
    public UpdateDiscountCodeCommandValidator() => RuleFor(x => x.Input).SetValidator(new DiscountCodeInputValidator());
}

internal static class DiscountCodeMapping
{
    public static DiscountCodeDto ToDto(DiscountCode d, DateTime now) =>
        new(d.Id, d.Code, d.PercentageOff, d.StartAt, d.EndAt, d.IsActive, d.UsageCount, d.IsCurrentlyValid(now));

    public static DateTime AsUtc(DateTime dt) => dt.Kind switch
    {
        DateTimeKind.Utc => dt,
        DateTimeKind.Local => dt.ToUniversalTime(),
        _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
    };
}

public sealed class ValidateDiscountCodeCommandHandler : IRequestHandler<ValidateDiscountCodeCommand, ValidateDiscountResult>
{
    private readonly IApplicationDbContext _db; private readonly IDateTimeProvider _clock;
    public ValidateDiscountCodeCommandHandler(IApplicationDbContext db, IDateTimeProvider clock) { _db = db; _clock = clock; }

    public async Task<ValidateDiscountResult> Handle(ValidateDiscountCodeCommand request, CancellationToken ct)
    {
        var code = request.Code!.Trim().ToUpperInvariant();
        var discount = await _db.DiscountCodes.AsNoTracking().FirstOrDefaultAsync(d => d.Code == code, ct);
        var amount = DiscountCalculator.TryApply(discount, request.Subtotal, _clock.UtcNow);
        return amount.HasValue ? new ValidateDiscountResult(true, amount.Value) : new ValidateDiscountResult(false, null);
    }
}

public sealed class GetDiscountCodesQueryHandler : IRequestHandler<GetDiscountCodesQuery, IReadOnlyList<DiscountCodeDto>>
{
    private readonly IApplicationDbContext _db; private readonly IDateTimeProvider _clock;
    public GetDiscountCodesQueryHandler(IApplicationDbContext db, IDateTimeProvider clock) { _db = db; _clock = clock; }

    public async Task<IReadOnlyList<DiscountCodeDto>> Handle(GetDiscountCodesQuery request, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var list = await _db.DiscountCodes.AsNoTracking().OrderByDescending(d => d.CreatedAt).ToListAsync(ct);
        return list.Select(d => DiscountCodeMapping.ToDto(d, now)).ToList();
    }
}

public sealed class CreateDiscountCodeCommandHandler : IRequestHandler<CreateDiscountCodeCommand, DiscountCodeDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public CreateDiscountCodeCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _audit = audit; _clock = clock; }

    public async Task<DiscountCodeDto> Handle(CreateDiscountCodeCommand request, CancellationToken ct)
    {
        var code = request.Input.Code.Trim().ToUpperInvariant();
        if (await _db.DiscountCodes.IgnoreQueryFilters().AnyAsync(d => d.Code == code, ct))
            throw new ConflictException("كود الخصم مستخدم مسبقًا.");

        var now = _clock.UtcNow;
        var entity = new DiscountCode
        {
            Code = code,
            PercentageOff = request.Input.PercentageOff,
            StartAt = DiscountCodeMapping.AsUtc(request.Input.StartAt),
            EndAt = DiscountCodeMapping.AsUtc(request.Input.EndAt),
            IsActive = request.Input.IsActive,
            CreatedAt = now
        };
        _db.DiscountCodes.Add(entity);
        _audit.Log("DiscountCodeCreated", nameof(DiscountCode), entity.Id, code);
        await _db.SaveChangesAsync(ct);
        return DiscountCodeMapping.ToDto(entity, now);
    }
}

public sealed class UpdateDiscountCodeCommandHandler : IRequestHandler<UpdateDiscountCodeCommand, DiscountCodeDto>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public UpdateDiscountCodeCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _audit = audit; _clock = clock; }

    public async Task<DiscountCodeDto> Handle(UpdateDiscountCodeCommand request, CancellationToken ct)
    {
        var entity = await _db.DiscountCodes.FirstOrDefaultAsync(d => d.Id == request.Id, ct) ?? throw new NotFoundException("كود الخصم", request.Id);
        var code = request.Input.Code.Trim().ToUpperInvariant();
        if (code != entity.Code && await _db.DiscountCodes.IgnoreQueryFilters().AnyAsync(d => d.Code == code && d.Id != entity.Id, ct))
            throw new ConflictException("كود الخصم مستخدم مسبقًا.");

        var now = _clock.UtcNow;
        entity.Code = code;
        entity.PercentageOff = request.Input.PercentageOff;
        entity.StartAt = DiscountCodeMapping.AsUtc(request.Input.StartAt);
        entity.EndAt = DiscountCodeMapping.AsUtc(request.Input.EndAt);
        entity.IsActive = request.Input.IsActive;
        entity.UpdatedAt = now;
        _audit.Log("DiscountCodeUpdated", nameof(DiscountCode), entity.Id, code);
        await _db.SaveChangesAsync(ct);
        return DiscountCodeMapping.ToDto(entity, now);
    }
}

public sealed class DeleteDiscountCodeCommandHandler : IRequestHandler<DeleteDiscountCodeCommand>
{
    private readonly IApplicationDbContext _db; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public DeleteDiscountCodeCommandHandler(IApplicationDbContext db, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _audit = audit; _clock = clock; }

    public async Task Handle(DeleteDiscountCodeCommand request, CancellationToken ct)
    {
        var entity = await _db.DiscountCodes.FirstOrDefaultAsync(d => d.Id == request.Id, ct) ?? throw new NotFoundException("كود الخصم", request.Id);
        entity.IsActive = false;
        entity.IsDeleted = true;
        entity.UpdatedAt = _clock.UtcNow;
        _audit.Log("DiscountCodeDeleted", nameof(DiscountCode), entity.Id, entity.Code);
        await _db.SaveChangesAsync(ct);
    }
}
