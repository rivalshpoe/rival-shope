using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Store.Domain.Entities;
using Store.Domain.Enums;
using Store.Infrastructure.Persistence.Entities;

namespace Store.Infrastructure.Persistence.Configurations;

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders", t =>
        {
            t.HasCheckConstraint("CK_Orders_Total_NonNegative", "\"Total\" >= 0");
            t.HasCheckConstraint("CK_Orders_Subtotal_NonNegative", "\"Subtotal\" >= 0");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.InvoiceNumber).HasMaxLength(30).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.CustomerName).HasMaxLength(100).IsRequired();
        b.Property(x => x.PhoneNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.WhatsAppCountryCode).HasMaxLength(5).IsRequired();
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.IdempotencyKey).HasMaxLength(128);
        b.Property(x => x.Subtotal).HasPrecision(18, 2);
        b.Property(x => x.DiscountAmount).HasPrecision(18, 2);
        b.Property(x => x.DeliveryFee).HasPrecision(18, 2);
        b.Property(x => x.Total).HasPrecision(18, 2);

        b.HasIndex(x => x.InvoiceNumber).IsUnique();
        b.HasIndex(x => x.IdempotencyKey).IsUnique(); // PostgreSQL: NULLs are distinct, so nullable-safe
        b.HasIndex(x => new { x.Status, x.CreatedAt });
        b.HasIndex(x => x.CreatedAt);
        b.HasIndex(x => x.DeviceId);
        b.HasIndex(x => x.IsCollected).HasFilter("\"IsCollected\" = true").HasDatabaseName("IX_Orders_IsCollected_Partial");

        b.HasOne(x => x.Device).WithMany(x => x.Orders).HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.DeliveryZone).WithMany().HasForeignKey(x => x.DeliveryZoneId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.DiscountCode).WithMany().HasForeignKey(x => x.DiscountCodeId).OnDelete(DeleteBehavior.SetNull);
        b.HasMany(x => x.Items).WithOne(x => x.Order).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.ToTable("OrderItems", t => t.HasCheckConstraint("CK_OrderItems_Quantity_Positive", "\"Quantity\" > 0"));
        b.HasKey(x => x.Id);
        b.Property(x => x.ProductTitleSnapshot).HasMaxLength(200).IsRequired();
        b.Property(x => x.ProductImageUrlSnapshot).HasMaxLength(1000);
        b.Property(x => x.SizeLabelSnapshot).HasMaxLength(50);
        b.Property(x => x.ColorNameSnapshot).HasMaxLength(50);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
        b.Ignore(x => x.LineTotal);

        b.HasIndex(x => x.OrderId);
        b.HasIndex(x => new { x.ProductId, x.CreatedAt });

        b.HasOne(x => x.Product).WithMany(x => x.OrderItems).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ProductSize).WithMany().HasForeignKey(x => x.ProductSizeId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(x => x.ProductColor).WithMany().HasForeignKey(x => x.ProductColorId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class DeliveryZoneConfiguration : IEntityTypeConfiguration<DeliveryZone>
{
    public void Configure(EntityTypeBuilder<DeliveryZone> b)
    {
        b.ToTable("DeliveryZones");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.ExtraFee).HasPrecision(18, 2);
        b.HasIndex(x => x.IsActive).HasFilter("\"IsActive\" = true").HasDatabaseName("IX_DeliveryZones_IsActive_Partial");
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class DiscountCodeConfiguration : IEntityTypeConfiguration<DiscountCode>
{
    public void Configure(EntityTypeBuilder<DiscountCode> b)
    {
        b.ToTable("DiscountCodes", t => t.HasCheckConstraint("CK_DiscountCodes_Percentage_Range", "\"PercentageOff\" BETWEEN 1 AND 100"));
        b.HasKey(x => x.Id);
        b.Property(x => x.Code).HasMaxLength(50).IsRequired();
        b.HasIndex(x => x.Code).IsUnique();
        b.HasIndex(x => new { x.IsActive, x.StartAt, x.EndAt });
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class DeviceConfiguration : IEntityTypeConfiguration<Device>
{
    public void Configure(EntityTypeBuilder<Device> b)
    {
        b.ToTable("Devices");
        b.HasKey(x => x.Id);
        b.Property(x => x.DeviceHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.DeviceHashEncrypted).IsRequired();
        b.Property(x => x.BlockedReason).HasMaxLength(300);
        b.HasIndex(x => x.DeviceHash).IsUnique();
        b.HasIndex(x => x.IsBlocked).HasFilter("\"IsBlocked\" = true").HasDatabaseName("IX_Devices_IsBlocked_Partial");
    }
}

public sealed class InventoryLogConfiguration : IEntityTypeConfiguration<InventoryLog>
{
    public void Configure(EntityTypeBuilder<InventoryLog> b)
    {
        b.ToTable("InventoryLogs");
        b.HasKey(x => x.Id);
        b.Property(x => x.ChangeType).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.Note).HasMaxLength(300);
        b.HasIndex(x => new { x.ProductId, x.CreatedAt });
        b.HasIndex(x => x.ProductSizeId);
        b.HasIndex(x => x.OrderId);
        b.HasOne(x => x.Product).WithMany(x => x.InventoryLogs).HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ProductSize).WithMany().HasForeignKey(x => x.ProductSizeId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("Notifications");
        b.HasKey(x => x.Id);
        b.Property(x => x.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        b.Property(x => x.Title).HasMaxLength(120).IsRequired();
        b.Property(x => x.Message).HasMaxLength(500).IsRequired();
        b.HasIndex(x => x.RelatedOrderId);
        b.HasIndex(x => x.CreatedAt).HasFilter("\"IsResolved\" = false").HasDatabaseName("IX_Notifications_Unresolved_Partial");
    }
}

public sealed class InvoiceCounterConfiguration : IEntityTypeConfiguration<InvoiceCounter>
{
    public void Configure(EntityTypeBuilder<InvoiceCounter> b)
    {
        b.ToTable("InvoiceCounters");
        b.HasKey(x => x.Date);
    }
}
