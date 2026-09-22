using Microsoft.EntityFrameworkCore;
using Store.Application.Common.Interfaces;
using Store.Domain.Rules;

namespace Store.Infrastructure.Persistence;

/// <summary>
/// Daily sequential counter via a single atomic UPSERT (row-level lock serialises concurrent orders on the same day).
/// Runs on the ambient DbContext connection, so it joins the order transaction.
/// </summary>
public sealed class InvoiceNumberGenerator : IInvoiceNumberGenerator
{
    private readonly StoreDbContext _db;
    public InvoiceNumberGenerator(StoreDbContext db) => _db = db;

    public async Task<string> NextAsync(DateTime utcNow, CancellationToken ct = default)
    {
        var date = DateOnly.FromDateTime(utcNow);
        // INSERT ... RETURNING is non-composable SQL: EF must execute it verbatim, so we must not
        // append LINQ operators (First/Single add a LIMIT wrapper and throw at runtime). ToListAsync
        // executes the statement as-is; the UPSERT always returns exactly one row.
        var rows = await _db.Database
            .SqlQuery<long>($"""
                INSERT INTO "InvoiceCounters" ("Date", "LastValue") VALUES ({date}, 1)
                ON CONFLICT ("Date") DO UPDATE SET "LastValue" = "InvoiceCounters"."LastValue" + 1
                RETURNING "LastValue" AS "Value"
                """)
            .ToListAsync(ct);
        if (rows.Count != 1)
            throw new InvalidOperationException("Invoice counter UPSERT did not return exactly one row.");
        return InvoiceNumber.Format(utcNow, rows[0]);
    }
}
