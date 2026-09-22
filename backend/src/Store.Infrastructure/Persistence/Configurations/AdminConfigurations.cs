using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Store.Domain.Entities;

namespace Store.Infrastructure.Persistence.Configurations;

public sealed class AdminUserConfiguration : IEntityTypeConfiguration<AdminUser>
{
    public void Configure(EntityTypeBuilder<AdminUser> b)
    {
        b.ToTable("AdminUsers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).HasMaxLength(254).IsRequired();
        b.HasIndex(x => x.Email).IsUnique();
        b.HasMany(x => x.RefreshTokens).WithOne(x => x.AdminUser).HasForeignKey(x => x.AdminUserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class AdminOtpCodeConfiguration : IEntityTypeConfiguration<AdminOtpCode>
{
    public void Configure(EntityTypeBuilder<AdminOtpCode> b)
    {
        b.ToTable("AdminOtpCodes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Email).HasMaxLength(254).IsRequired();
        b.Property(x => x.CodeHash).HasMaxLength(100).IsRequired();
        b.HasIndex(x => new { x.Email, x.ExpiresAt });
        b.HasIndex(x => new { x.Email, x.CreatedAt });
    }
}

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("RefreshTokens");
        b.HasKey(x => x.Id);
        b.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.ReplacedByTokenHash).HasMaxLength(64);
        b.Property(x => x.CreatedByIp).HasMaxLength(64);
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => new { x.AdminUserId, x.ExpiresAt });
    }
}

public sealed class AdminAuditLogConfiguration : IEntityTypeConfiguration<AdminAuditLog>
{
    public void Configure(EntityTypeBuilder<AdminAuditLog> b)
    {
        b.ToTable("AdminAuditLogs");
        b.HasKey(x => x.Id);
        b.Property(x => x.AdminEmail).HasMaxLength(254).IsRequired();
        b.Property(x => x.Action).HasMaxLength(80).IsRequired();
        b.Property(x => x.EntityType).HasMaxLength(80).IsRequired();
        b.Property(x => x.Details).HasMaxLength(1000);
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.HasIndex(x => x.AdminEmail);
        b.HasIndex(x => x.CreatedAt);
        b.HasIndex(x => new { x.EntityType, x.EntityId });
    }
}
