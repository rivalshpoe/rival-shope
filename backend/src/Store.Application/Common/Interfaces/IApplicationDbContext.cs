using Microsoft.EntityFrameworkCore;
using Store.Domain.Entities;

namespace Store.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Category> Categories { get; }
    DbSet<Brand> Brands { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductImage> ProductImages { get; }
    DbSet<ProductColor> ProductColors { get; }
    DbSet<ProductSize> ProductSizes { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<DeliveryZone> DeliveryZones { get; }
    DbSet<DiscountCode> DiscountCodes { get; }
    DbSet<Device> Devices { get; }
    DbSet<InventoryLog> InventoryLogs { get; }
    DbSet<AdminUser> AdminUsers { get; }
    DbSet<AdminOtpCode> AdminOtpCodes { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<AdminAuditLog> AdminAuditLogs { get; }
    DbSet<Policy> Policies { get; }
    DbSet<Review> Reviews { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>Runs <paramref name="action"/> inside a single database transaction (committed on success, rolled back on exception).</summary>
    Task<TResult> ExecuteInTransactionAsync<TResult>(Func<CancellationToken, Task<TResult>> action, CancellationToken cancellationToken = default);

    /// <summary>
    /// Provider-specific full-text-ish product search (ILIKE + pg_trgm similarity ordering) kept out of the Application layer.
    /// Returns an ordered, composable query over active products.
    /// </summary>
    IQueryable<Product> SearchProducts(string query, bool activeOnly = true);
}
