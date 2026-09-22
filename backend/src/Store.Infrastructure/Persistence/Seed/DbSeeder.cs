using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Store.Domain.Entities;

namespace Store.Infrastructure.Persistence.Seed;

/// <summary>Idempotent seed: admin user, root categories, sample brands, default policies and delivery zones.</summary>
public sealed class DbSeeder
{
    public const string DefaultAdminEmail = "rivalshpoe@gmail.com";

    private readonly StoreDbContext _db;
    private readonly ILogger<DbSeeder> _logger;

    public DbSeeder(StoreDbContext db, ILogger<DbSeeder> logger)
    {
        _db = db; _logger = logger;
    }

    public async Task SeedAsync(string? adminEmail, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var email = (string.IsNullOrWhiteSpace(adminEmail) ? DefaultAdminEmail : adminEmail).Trim().ToLowerInvariant();

        if (!await _db.AdminUsers.AnyAsync(a => a.Email == email, ct))
        {
            _db.AdminUsers.Add(new AdminUser { Email = email, IsActive = true, CreatedAt = now });
            _logger.LogInformation("Seeded admin user");
        }

        var categories = new (string Name, string Slug, int Sort)[]
        {
            ("حقائب ماركات", "brand-bags", 1),
            ("حقائب نسائية", "women-bags", 2),
            ("نظارات شمسية ماركات", "brand-sunglasses", 3),
            ("مشدات النحت الكولومبية", "colombian-shapewear", 4),
            ("إكسسوارات", "accessories", 5),
            ("أغطية وسائد حرير للبشرة والشعر", "silk-pillowcases", 6),
        };
        var existingSlugs = await _db.Categories.IgnoreQueryFilters().Select(c => c.Slug).ToListAsync(ct);
        foreach (var (name, slug, sort) in categories)
        {
            if (existingSlugs.Contains(slug)) continue;
            _db.Categories.Add(new Category { Name = name, Slug = slug, SortOrder = sort, IsActive = true, CreatedAt = now });
        }

        var brands = new (string Name, string Slug)[]
        {
            ("Louis Vuitton", "louis-vuitton"),
            ("Gucci", "gucci"),
            ("Chanel", "chanel"),
            ("Dior", "dior"),
            ("Ray-Ban", "ray-ban"),
        };
        var existingBrands = await _db.Brands.IgnoreQueryFilters().Select(b => b.Slug).ToListAsync(ct);
        foreach (var (name, slug) in brands)
        {
            if (existingBrands.Contains(slug)) continue;
            _db.Brands.Add(new Brand { Name = name, Slug = slug, CreatedAt = now });
        }

        var policies = new (string Key, string Title, string Content)[]
        {
            ("order", "سياسة الطلب", "يتم استلام الطلبات عبر المتجر كضيف دون الحاجة لإنشاء حساب. بعد إتمام الطلب سيتواصل معك فريق Rival عبر واتساب لتأكيد التفاصيل قبل الشحن."),
            ("cancellation", "سياسة الإلغاء", "يمكنك إلغاء الطلب قبل تأكيده من فريقنا دون أي رسوم. بعد التأكيد والشحن لا يمكن الإلغاء، ويمكنك الرجوع إلى سياسة الاستبدال والاسترجاع."),
            ("returns", "سياسة الاستبدال والاسترجاع", "يُقبل الاستبدال أو الاسترجاع خلال 3 أيام من الاستلام بشرط أن يكون المنتج بحالته الأصلية مع كامل الملحقات والتغليف. لا يشمل ذلك المنتجات المخفضة أو المستخدمة."),
            ("shipping", "سياسة الشحن والتوصيل", "نوفر خدمة التوصيل لجميع المناطق المتاحة في المتجر. تختلف رسوم التوصيل حسب المنطقة وتظهر بوضوح قبل تأكيد الطلب. مدة التوصيل المتوقعة من 2 إلى 5 أيام عمل."),
            ("privacy", "سياسة الخصوصية", "نحترم خصوصيتك. تُستخدم بياناتك (الاسم، رقم الهاتف، العنوان) فقط لمعالجة طلبك والتواصل معك، ولا تُشارك مع أي طرف ثالث إلا لغرض التوصيل."),
        };
        var existingPolicies = await _db.Policies.Select(p => p.Key).ToListAsync(ct);
        foreach (var (key, title, content) in policies)
        {
            if (existingPolicies.Contains(key)) continue;
            _db.Policies.Add(new Policy { Key = key, Title = title, Content = content, CreatedAt = now });
        }

        if (!await _db.DeliveryZones.IgnoreQueryFilters().AnyAsync(ct))
        {
            _db.DeliveryZones.Add(new DeliveryZone { Name = "الضفة الغربية", ExtraFee = 20m, IsActive = true, CreatedAt = now });
            _db.DeliveryZones.Add(new DeliveryZone { Name = "القدس والداخل", ExtraFee = 60m, IsActive = true, CreatedAt = now });
        }

        var written = await _db.SaveChangesAsync(ct);
        if (written > 0) _logger.LogInformation("Database seed applied ({Count} rows)", written);
    }
}
