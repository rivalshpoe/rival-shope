using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Exceptions;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;
using Store.Domain.Entities;

namespace Store.Application.Features.Devices;

public sealed record DeviceDto(Guid Id, string MaskedHash, int FakeOrderCount, int TotalOrders, bool IsBlocked, DateTime? BlockedAt, string? BlockedReason, DateTime? LastOrderAt, DateTime CreatedAt);

public sealed record GetDevicesQuery(bool BlockedOnly, int? Page, int? PageSize) : IRequest<PagedResult<DeviceDto>>;
public sealed record BlockDeviceCommand(Guid Id, bool IsBlocked, string? Reason) : IRequest<DeviceDto>;

public sealed class BlockDeviceCommandValidator : AbstractValidator<BlockDeviceCommand>
{
    public BlockDeviceCommandValidator() => RuleFor(x => x.Reason).MaximumLength(300).WithMessage("سبب الحظر طويل جدًا.");
}

public sealed class GetDevicesQueryHandler : IRequestHandler<GetDevicesQuery, PagedResult<DeviceDto>>
{
    private readonly IApplicationDbContext _db; private readonly IDeviceFingerprintService _fp;
    public GetDevicesQueryHandler(IApplicationDbContext db, IDeviceFingerprintService fp) { _db = db; _fp = fp; }

    public async Task<PagedResult<DeviceDto>> Handle(GetDevicesQuery request, CancellationToken ct)
    {
        var q = _db.Devices.AsNoTracking();
        if (request.BlockedOnly) q = q.Where(d => d.IsBlocked);
        var (page, pageSize) = Paging.Normalize(request.Page, request.PageSize);
        var total = await q.CountAsync(ct);
        var rows = await q.OrderByDescending(d => d.LastOrderAt ?? d.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var items = rows.Select(d => new DeviceDto(d.Id, _fp.Mask(d.DeviceHash), d.FakeOrderCount, d.TotalOrders, d.IsBlocked, d.BlockedAt, d.BlockedReason, d.LastOrderAt, d.CreatedAt)).ToList();
        return PagedResult<DeviceDto>.Create(items, page, pageSize, total);
    }
}

public sealed class BlockDeviceCommandHandler : IRequestHandler<BlockDeviceCommand, DeviceDto>
{
    private readonly IApplicationDbContext _db; private readonly IDeviceFingerprintService _fp; private readonly IAuditLogger _audit; private readonly IDateTimeProvider _clock;
    public BlockDeviceCommandHandler(IApplicationDbContext db, IDeviceFingerprintService fp, IAuditLogger audit, IDateTimeProvider clock) { _db = db; _fp = fp; _audit = audit; _clock = clock; }

    public async Task<DeviceDto> Handle(BlockDeviceCommand request, CancellationToken ct)
    {
        var d = await _db.Devices.FirstOrDefaultAsync(x => x.Id == request.Id, ct) ?? throw new NotFoundException("الجهاز", request.Id);
        var now = _clock.UtcNow;
        if (request.IsBlocked) d.Block(now, string.IsNullOrWhiteSpace(request.Reason) ? "حظر يدوي من الأدمن" : request.Reason.Trim());
        else d.Unblock(now);
        _audit.Log(request.IsBlocked ? "DeviceBlocked" : "DeviceUnblocked", nameof(Device), d.Id, request.Reason);
        await _db.SaveChangesAsync(ct);
        return new DeviceDto(d.Id, _fp.Mask(d.DeviceHash), d.FakeOrderCount, d.TotalOrders, d.IsBlocked, d.BlockedAt, d.BlockedReason, d.LastOrderAt, d.CreatedAt);
    }
}
