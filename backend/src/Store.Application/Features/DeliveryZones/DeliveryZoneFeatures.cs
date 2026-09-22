using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Caching;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Domain.Entities;

namespace Store.Application.Features.DeliveryZones;

public sealed record DeliveryZoneDto(Guid Id, string Name, decimal? ExtraFee, bool IsActive);
public sealed record DeliveryZoneInput(string Name, decimal? ExtraFee, bool IsActive);

public sealed record GetDeliveryZonesQuery(bool ActiveOnly) : IRequest<IReadOnlyList<DeliveryZoneDto>>;
public sealed record CreateDeliveryZoneCommand(DeliveryZoneInput Input) : IRequest<DeliveryZoneDto>;
public sealed record UpdateDeliveryZoneCommand(Guid Id, DeliveryZoneInput Input) : IRequest<DeliveryZoneDto>;
public sealed record DeleteDeliveryZoneCommand(Guid Id) : IRequest;

public sealed class DeliveryZoneInputValidator : AbstractValidator<DeliveryZoneInput>
{
    public DeliveryZoneInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("اسم المنطقة مطلوب.").MaximumLength(120).WithMessage("اسم المنطقة طويل جدًا.");
        RuleFor(x => x.ExtraFee).GreaterThanOrEqualTo(0).When(x => x.ExtraFee.HasValue).WithMessage("رسوم التوصيل لا يمكن أن تكون سالبة.");
    }
}
public sealed class CreateDeliveryZoneCommandValidator : AbstractValidator<CreateDeliveryZoneCommand>
{
    public CreateDeliveryZoneCommandValidator() => RuleFor(x => x.Input).SetValidator(new DeliveryZoneInputValidator());
}
public sealed class UpdateDeliveryZoneCommandValidator : AbstractValidator<UpdateDeliveryZoneCommand>
{
    public UpdateDeliveryZoneCommandValidator() => RuleFor(x => x.Input).SetValidator(new DeliveryZoneInputValidator());
}

public sealed class GetDeliveryZonesQueryHandler : IRequestHandler<GetDeliveryZonesQuery, IReadOnlyList<DeliveryZoneDto>>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache;
    public GetDeliveryZonesQueryHandler(IApplicationDbContext db, ICacheService cache) { _db = db; _cache = cache; }

    public Task<IReadOnlyList<DeliveryZoneDto>> Handle(GetDeliveryZonesQuery request, CancellationToken ct)
    {
        if (!request.ActiveOnly) return Load(false, ct);
        return _cache.GetOrSetAsync(CacheKeys.DeliveryZonesActive, CacheKeys.Ttl.DeliveryZones, c => Load(true, c), ct);
    }

    private async Task<IReadOnlyList<DeliveryZoneDto>> Load(bool activeOnly, CancellationToken ct)
    {
        var q = _db.DeliveryZones.AsNoTracking();
        if (activeOnly) q = q.Where(z => z.IsActive);
        return await q.OrderBy(z => z.Name).Select(z => new DeliveryZoneDto(z.Id, z.Name, z.ExtraFee, z.IsActive)).ToListAsync(ct);
    }
}

public sealed class CreateDeliveryZoneCommandHandler : IRequestHandler<CreateDeliveryZoneCommand, DeliveryZoneDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public CreateDeliveryZoneCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<DeliveryZoneDto> Handle(CreateDeliveryZoneCommand request, CancellationToken ct)
    {
        var zone = new DeliveryZone { Name = request.Input.Name.Trim(), ExtraFee = request.Input.ExtraFee, IsActive = request.Input.IsActive, CreatedAt = _clock.UtcNow };
        _db.DeliveryZones.Add(zone);
        _audit.Log("DeliveryZoneCreated", nameof(DeliveryZone), zone.Id, zone.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.DeliveryZonesAsync(_cache, ct);
        return new DeliveryZoneDto(zone.Id, zone.Name, zone.ExtraFee, zone.IsActive);
    }
}

public sealed class UpdateDeliveryZoneCommandHandler : IRequestHandler<UpdateDeliveryZoneCommand, DeliveryZoneDto>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public UpdateDeliveryZoneCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task<DeliveryZoneDto> Handle(UpdateDeliveryZoneCommand request, CancellationToken ct)
    {
        var zone = await _db.DeliveryZones.FirstOrDefaultAsync(z => z.Id == request.Id, ct) ?? throw new NotFoundException("منطقة التوصيل", request.Id);
        zone.Name = request.Input.Name.Trim();
        zone.ExtraFee = request.Input.ExtraFee;
        zone.IsActive = request.Input.IsActive;
        zone.UpdatedAt = _clock.UtcNow;
        _audit.Log("DeliveryZoneUpdated", nameof(DeliveryZone), zone.Id, zone.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.DeliveryZonesAsync(_cache, ct);
        return new DeliveryZoneDto(zone.Id, zone.Name, zone.ExtraFee, zone.IsActive);
    }
}

public sealed class DeleteDeliveryZoneCommandHandler : IRequestHandler<DeleteDeliveryZoneCommand>
{
    private readonly IApplicationDbContext _db; private readonly ICacheService _cache; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public DeleteDeliveryZoneCommandHandler(IApplicationDbContext db, ICacheService cache, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _cache = cache; _audit = audit; _clock = clock; }

    public async Task Handle(DeleteDeliveryZoneCommand request, CancellationToken ct)
    {
        var zone = await _db.DeliveryZones.FirstOrDefaultAsync(z => z.Id == request.Id, ct) ?? throw new NotFoundException("منطقة التوصيل", request.Id);
        zone.IsActive = false;
        zone.IsDeleted = true; // orders keep DeliveryZoneId (query filter ignored where needed)
        zone.UpdatedAt = _clock.UtcNow;
        _audit.Log("DeliveryZoneDeleted", nameof(DeliveryZone), zone.Id, zone.Name);
        await _db.SaveChangesAsync(ct);
        await CacheInvalidation.DeliveryZonesAsync(_cache, ct);
    }
}
