using MediatR;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Interfaces;
using Store.Application.Common.Models;

namespace Store.Application.Features.AuditLogs;

public sealed record AuditLogDto(Guid Id, string AdminEmail, string Action, string EntityType, Guid? EntityId, string? Details, string? IpAddress, DateTime CreatedAt);

public sealed record GetAuditLogsQuery(int? Page, int? PageSize) : IRequest<PagedResult<AuditLogDto>>;

public sealed class GetAuditLogsQueryHandler : IRequestHandler<GetAuditLogsQuery, PagedResult<AuditLogDto>>
{
    private readonly IApplicationDbContext _db;
    public GetAuditLogsQueryHandler(IApplicationDbContext db) => _db = db;

    public Task<PagedResult<AuditLogDto>> Handle(GetAuditLogsQuery request, CancellationToken ct) =>
        _db.AdminAuditLogs.AsNoTracking()
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AuditLogDto(a.Id, a.AdminEmail, a.Action, a.EntityType, a.EntityId, a.Details, a.IpAddress, a.CreatedAt))
            .ToPagedResultAsync(request.Page, request.PageSize, ct);
}
