-- Rival — تقرير تحقق أمني لقاعدة البيانات
--   psql -U postgres -h <host> -d rival -f 03-verify.sql

\set ON_ERROR_STOP on
\pset pager off

\echo '== 1) الأدوار وصلاحياتها العامة =='
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolconnlimit
FROM pg_roles
WHERE rolname LIKE 'rival%'
ORDER BY rolname;

\echo '== 2) إعدادات كل دور (timeouts) =='
SELECT r.rolname, s.setconfig
FROM pg_db_role_setting s
JOIN pg_roles r ON r.oid = s.setrole
WHERE r.rolname LIKE 'rival%';

\echo '== 3) طريقة تشفير كلمات المرور (يجب scram-sha-256) =='
SELECT rolname,
       CASE WHEN rolpassword LIKE 'SCRAM-SHA-256%' THEN 'scram-sha-256' ELSE 'WEAK/OTHER' END AS auth
FROM pg_authid
WHERE rolname LIKE 'rival%'
ORDER BY rolname;

\echo '== 4) صلاحيات الاتصال بالقاعدة (يجب ألا يظهر PUBLIC) =='
SELECT datname, datacl FROM pg_database WHERE datname = current_database();

\echo '== 5) صلاحيات المخطط public (يجب ألا يملك PUBLIC أي CREATE) =='
SELECT nspname, nspowner::regrole AS owner, nspacl FROM pg_namespace WHERE nspname = 'public';

\echo '== 6) عدد الجداول والفهارس والقيود =='
SELECT (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')            AS tables,
       (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public')           AS indexes,
       (SELECT count(*) FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public' AND c.contype = 'c')                       AS check_constraints,
       (SELECT count(*) FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public' AND c.contype = 'f')                       AS foreign_keys;

\echo '== 7) فهرس البحث GIN (pg_trgm) =='
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND indexdef ILIKE '%gin%';

\echo '== 8) جداول بلا مفتاح أساسي (يجب أن تكون النتيجة فارغة) =='
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND cl.relname = t.tablename AND c.contype = 'p');

\echo '== 9) صلاحيات دور التطبيق على الجداول (يجب DML فقط) =='
SELECT table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE grantee = 'rival_app' AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

\echo '== 10) الجداول الحساسة يجب ألا تكون مقروءة لدور القراءة =='
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'rival_readonly'
  AND table_name IN ('AdminUsers', 'AdminOtpCodes', 'RefreshTokens', 'Devices');

\echo '== 11) الإضافات المثبتة =='
SELECT extname, extversion FROM pg_extension ORDER BY extname;

\echo '== 12) إعدادات القاعدة (UTC + التسجيل) =='
SELECT datname, setconfig FROM pg_db_role_setting s
JOIN pg_database d ON d.oid = s.setdatabase
WHERE d.datname = current_database();

\echo '== 13) التشفير أثناء النقل (SSL) =='
SHOW ssl;

\echo '== 14) قواعد المصادقة الفعّالة (pg_hba) =='
SELECT type, database, user_name, address, auth_method
FROM pg_hba_file_rules
WHERE error IS NULL
ORDER BY line_number;
