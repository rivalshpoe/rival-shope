namespace Store.Infrastructure.Persistence.Entities;

/// <summary>Infrastructure-only daily counter backing RIV-YYYYMMDD-NNNN invoice numbers (atomic UPSERT ... RETURNING).</summary>
public sealed class InvoiceCounter
{
    public DateOnly Date { get; set; }
    public long LastValue { get; set; }
}
