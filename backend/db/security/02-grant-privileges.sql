-- Rival — صلاحيات المخطط والجداول بأقل صلاحية ممكنة
-- يُنفَّذ بدور superuser داخل قاعدة rival بعد إنشاء الأدوار، ويُعاد تنفيذه بعد كل Migration جديد:
--   إنتاج:  psql -U postgres -h <host> -d rival -v ON_ERROR_STOP=1 -v owner_role=rival_owner -f 02-grant-privileges.sql
--   تطوير:  psql -U postgres -h localhost -d rival -v ON_ERROR_STOP=1 -v owner_role=rival     -f 02-grant-privileges.sql
-- (في التطوير يكون دور التطبيق نفسه هو المالك حتى تعمل الـ Migrations تلقائيًا)

-- الإضافات المطلوبة للبحث (تثبيتها يحتاج superuser، فلا يحتاج دور التطبيق أي صلاحية إضافية)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- مالك المخطط + منع PUBLIC من إنشاء أي شيء داخله
SELECT format('ALTER SCHEMA public OWNER TO %I', :'owner_role') \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('GRANT USAGE, CREATE ON SCHEMA public TO %I', :'owner_role') \gexec
GRANT USAGE ON SCHEMA public TO rival_app, rival_readonly;

-- منع PUBLIC من تنفيذ أي دوال تُنشأ مستقبلًا
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- دور التطبيق: DML فقط، بلا TRUNCATE وبلا REFERENCES وبلا DDL
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rival_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rival_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM rival_app;

-- دور القراءة: SELECT فقط
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rival_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO rival_readonly;

-- صلاحيات افتراضية: أي جدول/تسلسل ينشئه المالك في Migration لاحق يحصل عليها تلقائيًا
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rival_app', :'owner_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rival_app', :'owner_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON TABLES TO rival_readonly', :'owner_role') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT ON SEQUENCES TO rival_readonly', :'owner_role') \gexec

-- سجل الـ Migrations: التطبيق يقرأه فقط (EF يتحقق منه عند الإقلاع) ولا يكتب فيه
SELECT 'REVOKE INSERT, UPDATE, DELETE ON TABLE public."__EFMigrationsHistory" FROM rival_app'
WHERE EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '__EFMigrationsHistory')
  AND :'owner_role' <> 'rival_app'
\gexec

-- الجداول الحساسة: دور القراءة/النسخ الاحتياطي لا يرى أسرار المصادقة ولا بصمات الأجهزة
SELECT format('REVOKE ALL ON TABLE public.%I FROM rival_readonly', tablename)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('AdminUsers', 'AdminOtpCodes', 'RefreshTokens', 'Devices')
\gexec
