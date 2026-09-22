-- Rival — إنشاء قاعدة البيانات وأدوار الوصول بأقل صلاحية ممكنة
-- يُنفَّذ مرة واحدة بدور superuser (postgres) وهو متصل بقاعدة postgres:
--   psql -U postgres -h <host> -d postgres -v ON_ERROR_STOP=1 \
--     -v db_name=rival \
--     -v owner_password='<strong>' -v app_password='<strong>' -v readonly_password='<strong>' \
--     -f 01-create-roles.sql
-- لا تُكتب أي كلمة مرور داخل هذا الملف؛ تُمرَّر كمتغيرات psql فقط ولا تُحفظ في Git.

-- 1) rival_owner: مالك المخطط، يُستخدم للـ Migrations فقط (DDL). ليس superuser.
SELECT 'CREATE ROLE rival_owner NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rival_owner')
\gexec

SELECT format('ALTER ROLE rival_owner LOGIN PASSWORD %L', :'owner_password') \gexec
ALTER ROLE rival_owner NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
ALTER ROLE rival_owner CONNECTION LIMIT 10;
ALTER ROLE rival_owner SET statement_timeout = '600s';
ALTER ROLE rival_owner SET lock_timeout = '30s';
ALTER ROLE rival_owner SET idle_in_transaction_session_timeout = '120s';

-- 2) rival_app: دور التطبيق في الإنتاج — بيانات فقط (DML)، بلا أي DDL.
SELECT 'CREATE ROLE rival_app NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rival_app')
\gexec

SELECT format('ALTER ROLE rival_app LOGIN PASSWORD %L', :'app_password') \gexec
ALTER ROLE rival_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
ALTER ROLE rival_app CONNECTION LIMIT 120;                  -- أعلى من Maximum Pool Size=100
ALTER ROLE rival_app SET statement_timeout = '15s';         -- يوقف الاستعلامات الثقيلة/الهجمات البطيئة
ALTER ROLE rival_app SET lock_timeout = '5s';
ALTER ROLE rival_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE rival_app SET search_path = public;

-- 3) rival_readonly: للنسخ الاحتياطي والتقارير — SELECT فقط.
SELECT 'CREATE ROLE rival_readonly NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rival_readonly')
\gexec

SELECT format('ALTER ROLE rival_readonly LOGIN PASSWORD %L', :'readonly_password') \gexec
ALTER ROLE rival_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
ALTER ROLE rival_readonly CONNECTION LIMIT 5;
ALTER ROLE rival_readonly SET default_transaction_read_only = on;
ALTER ROLE rival_readonly SET statement_timeout = '120s';

-- 4) القاعدة نفسها إن لم تكن موجودة، مالكها rival_owner، UTF8.
SELECT format('CREATE DATABASE %I OWNER rival_owner ENCODING ''UTF8'' TEMPLATE template0', :'db_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec

-- 5) لا اتصال لأي دور عام بالقاعدة.
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db_name" TO rival_owner;
GRANT CONNECT ON DATABASE :"db_name" TO rival_app;
GRANT CONNECT ON DATABASE :"db_name" TO rival_readonly;

-- 6) إعدادات على مستوى القاعدة: UTC حصرًا + تسجيل تغييرات البنية والاستعلامات البطيئة.
ALTER DATABASE :"db_name" SET timezone = 'UTC';
ALTER DATABASE :"db_name" SET log_statement = 'ddl';
ALTER DATABASE :"db_name" SET log_min_duration_statement = 1000;
ALTER DATABASE :"db_name" SET log_lock_waits = on;
