using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Store.Infrastructure.Persistence;

/// <summary>Design-time factory for <c>dotnet ef</c>; no live database is needed to add migrations.</summary>
public sealed class StoreDbContextFactory : IDesignTimeDbContextFactory<StoreDbContext>
{
    public StoreDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Postgres")
                               ?? "Host=localhost;Port=5432;Database=rival;Username=rival;Password=rival_dev_password";
        var options = new DbContextOptionsBuilder<StoreDbContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsAssembly(typeof(StoreDbContext).Assembly.FullName))
            .Options;
        return new StoreDbContext(options);
    }
}
