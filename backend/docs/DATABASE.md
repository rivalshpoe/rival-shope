# قاعدة بيانات Rival — PostgreSQL 16

قاعدة البيانات هي المصدر الوحيد للحقيقة في المشروع: كل ما يحتاج تخزينًا يُخزَّن فيها (لا ملفات JSON ولا ذاكرة مؤقتة كمصدر أساسي). Redis طبقة تسريع فقط، وإذا تعطّل يعمل الموقع دون أي فقدان بيانات.

## 1. الاتصال بالباك إند

الاتصال يُقرأ من الإعدادات فقط (`ConnectionStrings:Postgres`)، ولا يوجد أي اتصال مكتوب داخل الكود.

| البيئة | من أين تُقرأ | الدور المستخدم |
|---|---|---|
| تطوير محلي | `src/Store.Api/appsettings.Development.json` (قيم تطوير معلَّمة بوضوح) أو `dotnet user-secrets` | `rival` (مالك + Migrations) |
| إنتاج | متغير بيئة `ConnectionStrings__Postgres` من ملف `.env` على السيرفر فقط | `rival_app` (بيانات فقط) |

صيغة الإنتاج الموصى بها (SSL إلزامي والتحقق من الشهادة):

```
Host=<db-host>;Port=25060;Database=rival;Username=rival_app;Password=<من .env>;
SSL Mode=VerifyFull;Root Certificate=/opt/rival/certs/ca-certificate.crt;
Maximum Pool Size=100;Minimum Pool Size=5;Connection Idle Lifetime=300;
Timeout=15;Command Timeout=30;Include Error Detail=false
```

`Include Error Detail=false` مهم في الإنتاج حتى لا تصل تفاصيل الجداول والقيم إلى رسائل الأخطاء.

## 2. نموذج الأدوار (أقل صلاحية ممكنة)

| الدور | الاستخدام | الصلاحيات |
|---|---|---|
| `postgres` (superuser) | إنشاء القاعدة والأدوار والإضافات فقط، يدويًا | كل شيء — لا يستخدمه التطبيق أبدًا |
| `rival_owner` | تنفيذ الـ Migrations فقط | مالك المخطط: DDL + DML، `NOSUPERUSER NOCREATEDB NOCREATEROLE` |
| `rival_app` | التطبيق في وقت التشغيل | `SELECT/INSERT/UPDATE/DELETE` فقط، بلا `TRUNCATE` وبلا DDL، `statement_timeout=15s` |
| `rival_readonly` | النسخ الاحتياطي والتقارير | `SELECT` فقط، ولا يرى `AdminUsers` / `AdminOtpCodes` / `RefreshTokens` / `Devices` |
| `rival` | التطوير المحلي فقط (مالك + تطبيق في آن) | DDL + DML على قاعدة التطوير، غير موجود في الإنتاج |

الأدوار الثلاثة كلها `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`، ولكل منها حد اتصالات و`statement_timeout` و`lock_timeout` و`idle_in_transaction_session_timeout` حتى لا يعلّق استعلام أو Transaction مفتوحة القاعدة.

## 3. تطبيق الإعداد

```powershell
# 1) الأدوار والقاعدة (مرة واحدة، بدور superuser، وكلمات مرور قوية من openssl rand -base64 32)
psql -U postgres -h <host> -d postgres -v ON_ERROR_STOP=1 `
  -v db_name=rival -v owner_password='<...>' -v app_password='<...>' -v readonly_password='<...>' `
  -f db/security/01-create-roles.sql

# 2) الـ Migrations بدور المالك
$env:ConnectionStrings__Postgres = "Host=...;Username=rival_owner;Password=<...>;..."
dotnet ef database update --project src/Store.Infrastructure --startup-project src/Store.Api

# 3) الصلاحيات (بعد كل Migration جديد)
psql -U postgres -h <host> -d rival -v ON_ERROR_STOP=1 -v owner_role=rival_owner `
  -f db/security/02-grant-privileges.sql

# 4) تقرير التحقق الأمني
psql -U postgres -h <host> -d rival -f db/security/03-verify.sql
```

في التطوير المحلي: نفس الخطوات مع `-v owner_role=rival`، لأن دور التطوير هو المالك والتطبيق معًا.

## 4. ما يُخزَّن في القاعدة

| المجال | الجداول |
|---|---|
| الكتالوج | `Categories` (شجرة رئيسي/فرعي بصور)، `Brands`، `Products`، `ProductImages` (الأولى رئيسية + مصغّرة WebP)، `ProductColors`، `ProductSizes` (سعر ومخزون لكل مقاس) |
| الطلبات | `Orders` (رقم فاتورة، حالة، تحصيل، `EditableUntil`، `IdempotencyKey` فريد)، `OrderItems` (Snapshot للسعر والعنوان والمقاس واللون) |
| المخزون | `InventoryLogs` (Sale / Restock / Depleted / Return مع الكمية والمخزون بعدها وملاحظة ومن نفّذها) |
| التجارة | `DiscountCodes` (نسبة + نافذة زمنية + عدد الاستخدام)، `DeliveryZones`، `InvoiceCounters` (ترقيم فواتير ذرّي يوميًا) |
| مكافحة التلاعب | `Devices` (بصمة مُهشَّمة HMAC ومشفّرة AES-256-GCM، عدد الطلبات الوهمية، الحظر وسببه) |
| الإدارة | `AdminUsers`، `AdminOtpCodes` (مُهشَّم BCrypt مع انتهاء ومحاولات)، `RefreshTokens` (مُهشَّم + تدوير + إبطال)، `AdminAuditLogs` (كل عملية إدارية) |
| المحتوى | `Policies` (5 سياسات)، `Reviews` (تقييم + نص + صورة + اعتماد) |
| التشغيل | `Notifications` (تبقى غير محلولة حتى الرد)، `__EFMigrationsHistory` |

قواعد عامة مطبَّقة على كل الجداول: `Id` من نوع `uuid`، أوقات UTC حصرًا، حذف ناعم `IsDeleted` مع Global Query Filter، `RowVersion` (xmin) لمنع التعارض، مفاتيح أجنبية وقيود `CHECK` (سعر > 0، مخزون ≥ 0، تقييم 1..5)، وفهارس فريدة/مركبة/جزئية + فهرس GIN `pg_trgm` للبحث.

## 5. الأمان

- **المصادقة:** `scram-sha-256` لكل الأدوار، ولا `trust` ولا `md5` في `pg_hba.conf`.
- **الشبكة:** محليًا الاستماع على `127.0.0.1` فقط. في الإنتاج: القاعدة على شبكة خاصة (VPC) أو `ufw` يمنع 5432 من الإنترنت، والاتصال `SSL Mode=VerifyFull`.
- **الصلاحيات:** `REVOKE ALL ON DATABASE ... FROM PUBLIC` و`REVOKE ALL ON SCHEMA public FROM PUBLIC`، فلا يستطيع أي دور جديد رؤية البيانات أو إنشاء جداول.
- **العزل:** دور التطبيق لا يملك DDL؛ حتى لو حدث استغلال في التطبيق لا يمكن حذف جدول أو تعديل البنية.
- **الأسرار:** لا كلمة مرور في الكود أو Git؛ التطوير عبر `dotnet user-secrets`، والإنتاج عبر `.env` على السيرفر أو متغيرات مشفّرة في لوحة DigitalOcean.
- **البيانات الحساسة:** كلمات مرور/OTP مُهشَّمة BCrypt، Refresh Tokens مُهشَّمة، بصمات الأجهزة HMAC + AES-256-GCM. لا تُسجَّل في اللوج أبدًا.
- **التتبع:** `AdminAuditLogs` لكل عملية إدارية، و`log_statement='ddl'` + `log_min_duration_statement=1000` على مستوى القاعدة.
- **الحماية من الحمل:** حدود اتصالات لكل دور + `statement_timeout` + Pagination بحد 50 + Rate Limiting في التطبيق.
- **حقن SQL:** كل الاستعلامات عبر EF Core مع معاملات؛ البحث يُقصّ إلى 100 حرف قبل لمس القاعدة.

## 6. النسخ الاحتياطي والاستعادة

`db/backup/pg_backup.sh` ينشئ نسخة مضغوطة مشفّرة ويرفعها إلى DigitalOcean Spaces ويحذف النسخ الأقدم من 30 يومًا (يُجدول بـ cron كل 6 ساعات). الاستعادة عبر `db/backup/pg_restore.sh`. جرّب الاستعادة على قاعدة اختبار قبل الاعتماد عليها.

## 7. الصيانة الدورية

- مراجعة `03-verify.sql` بعد كل نشر.
- تدوير كلمات مرور الأدوار كل 90 يومًا (`ALTER ROLE ... PASSWORD` ثم تحديث `.env` وإعادة تشغيل الحاوية).
- متابعة `pg_stat_activity` و`pg_stat_user_indexes` لحذف الفهارس غير المستخدمة وإضافة ما يلزم.
- `VACUUM (ANALYZE)` تلقائي مفعّل؛ راقب `n_dead_tup` على `Orders` و`InventoryLogs`.
