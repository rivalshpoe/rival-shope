using Store.Application.Common.Interfaces;
using Store.Domain.Entities;

namespace Store.Infrastructure.Persistence;

/// <summary>Adds an <see cref="AdminAuditLog"/> row to the current unit of work; persisted with the handler's SaveChanges (same transaction).</summary>
public sealed class AuditLogger : IAuditLogger
{
    private readonly StoreDbContext _db;
    private readonly ICurrentAdminService _admin;
    private readonly IRequestContext _request;
    private readonly IDateTimeProvider _clock;

    public AuditLogger(StoreDbContext db, ICurrentAdminService admin, IRequestContext request, IDateTimeProvider clock)
    {
        _db = db; _admin = admin; _request = request; _clock = clock;
    }

    public void Log(string action, string entityType, Guid? entityId = null, string? details = null, string? adminEmailOverride = null)
    {
        _db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminEmail = adminEmailOverride ?? _admin.Email ?? "system",
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details is { Length: > 1000 } ? details[..1000] : details,
            IpAddress = _request.IpAddress,
            CreatedAt = _clock.UtcNow
        });
    }
}
