namespace Store.Domain.Common;

/// <summary>
/// Base for every persisted entity. All timestamps are UTC.
/// <see cref="RowVersion"/> is mapped to the PostgreSQL system column <c>xmin</c> (optimistic concurrency token).
/// </summary>
public abstract class AuditableEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public uint RowVersion { get; set; }
}
