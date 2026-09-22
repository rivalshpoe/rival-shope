using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Store.Application.Common.Interfaces;
using Store.Domain.Common;
using Store.Domain.Entities;
using Store.Infrastructure.Persistence.Entities;

namespace Store.Infrastructure.Persistence;

public class StoreDbContext : DbContext, IApplicationDbContext
{
    public StoreDbContext(DbContextOptions<StoreDbContext> options) : base(options) { }

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<ProductColor> ProductColors => Set<ProductColor>();
    public DbSet<ProductSize> ProductSizes => Set<ProductSize>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<DeliveryZone> DeliveryZones => Set<DeliveryZone>();
    public DbSet<DiscountCode> DiscountCodes => Set<DiscountCode>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<InventoryLog> InventoryLogs => Set<InventoryLog>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();
    public DbSet<AdminOtpCode> AdminOtpCodes => Set<AdminOtpCode>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AdminAuditLog> AdminAuditLogs => Set<AdminAuditLog>();
    public DbSet<Policy> Policies => Set<Policy>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<InvoiceCounter> InvoiceCounters => Set<InvoiceCounter>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Money: decimal(18,2) everywhere.
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
        // All timestamps stored/read as UTC (timestamptz); applies to DateTime? as well.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<string>().HaveMaxLength(1000);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pg_trgm");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(StoreDbContext).Assembly);

        // Optimistic concurrency via PostgreSQL xmin for every entity.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(AuditableEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType).Property<uint>(nameof(AuditableEntity.RowVersion)).IsRowVersion();
            }
        }

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added when entry.Entity.CreatedAt == default:
                    entry.Entity.CreatedAt = now;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt ??= now;
                    break;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }

    public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<CancellationToken, Task<TResult>> action, CancellationToken cancellationToken = default)
    {
        if (Database.CurrentTransaction is not null)
            return await action(cancellationToken);

        await using var tx = await Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var result = await action(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            try { await tx.RollbackAsync(CancellationToken.None); } catch { /* connection may already be gone */ }
            throw;
        }
    }

    /// <summary>ILIKE prefilter (uses the pg_trgm GIN index) ordered by trigram similarity, then recency.</summary>
    public IQueryable<Product> SearchProducts(string query, bool activeOnly = true)
    {
        var term = query.Trim();
        var pattern = $"%{EscapeLike(term)}%";
        IQueryable<Product> q = Products;
        if (activeOnly) q = q.Where(p => p.IsActive);
        return q
            .Where(p => EF.Functions.ILike(p.Title, pattern) || EF.Functions.ILike(p.Description, pattern)
                        || EF.Functions.TrigramsSimilarity(p.Title, term) > 0.3)
            .OrderByDescending(p => EF.Functions.TrigramsSimilarity(p.Title, term))
            .ThenByDescending(p => p.CreatedAt);
    }

    private static string EscapeLike(string value) =>
        value.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_");
}

/// <summary>Ensures every DateTime round-trips as UTC (Npgsql timestamptz requires Kind=Utc on write).</summary>
public sealed class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter() : base(
        v => v.Kind == DateTimeKind.Utc ? v : (v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : DateTime.SpecifyKind(v, DateTimeKind.Utc)),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc))
    { }
}
