-- Rival — فحص سريع لبيانات التهيئة (Seed)
--   psql -U postgres -h localhost -d rival -f 04-seed-check.sql
\pset pager off

SELECT (SELECT count(*) FROM "Categories")    AS categories,
       (SELECT count(*) FROM "Brands")        AS brands,
       (SELECT count(*) FROM "Policies")      AS policies,
       (SELECT count(*) FROM "AdminUsers")    AS admins,
       (SELECT count(*) FROM "DeliveryZones") AS delivery_zones,
       (SELECT count(*) FROM "Products")      AS products,
       (SELECT count(*) FROM "Orders")        AS orders;

SELECT "Email", "IsActive" FROM "AdminUsers";
SELECT "Slug", "Name", "ParentCategoryId" IS NULL AS is_root FROM "Categories" ORDER BY "SortOrder", "Name";
SELECT * FROM "__EFMigrationsHistory";
SELECT "Key", "Title", "UpdatedAt" FROM "Policies" ORDER BY "Key";
