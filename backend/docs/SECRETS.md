# إدارة الأسرار في Rival

القاعدة: **لا يوجد أي سر داخل الكود أو الريبو أو Git.** كل سر يُقرأ من الإعدادات وقت التشغيل (`IConfiguration`)، والقيم تأتي من مخزن خارج المشروع.

## أين يُحفظ كل سر

| البيئة | المخزن | الموقع |
|---|---|---|
| تطوير محلي | .NET User Secrets | `%APPDATA%\Microsoft\UserSecrets\rival-store-api-7c1f3c2e-2b7a-4b1e-9d1a-5e6f8a9b0c1d\secrets.json` (خارج مجلد المشروع، لا يراه Git إطلاقًا) |
| إنتاج (Droplet + Docker) | ملف `.env` يُنشأ على السيرفر فقط | `/opt/rival/.env` بصلاحية `chmod 600` ويُحمَّل عبر `docker compose --env-file` |
| إنتاج (App Platform) | متغيّرات بيئة مشفّرة في لوحة DigitalOcean | نوع `SECRET` لكل مفتاح |

`.gitignore` يستثني `.env`, `.env.*`, `secrets.json`, `*.pem`, `*.key`, `*.pfx`. الملف الوحيد المسموح رفعه هو `.env.example` وفيه قيم وهمية فقط.

## قائمة الأسرار

| المفتاح (Configuration) | متغيّر البيئة المقابل | الوصف |
|---|---|---|
| `ConnectionStrings:Postgres` | `ConnectionStrings__Postgres` | اتصال القاعدة بدور `rival_app` في الإنتاج |
| `Redis:ConnectionString` | `Redis__ConnectionString` | Redis (اختياري؛ عند غيابه يعمل بديل الذاكرة) |
| `Jwt:Secret` | `Jwt__Secret` | ≥ 48 بايت عشوائي (`openssl rand -base64 48`) |
| `Security:DeviceHmacKey` | `Security__DeviceHmacKey` | مفتاح HMAC-SHA256 لبصمة الجهاز |
| `Security:AesKey` | `Security__AesKey` | مفتاح AES-256-GCM (32 بايت Base64) |
| `Resend:ApiKey` | `Resend__ApiKey` | مفتاح Resend لإرسال رمز تحقق الأدمن **فقط** |
| `Resend:From` | `Resend__From` | المرسِل، مثل `Rival <no-reply@yourdomain.com>` |
| `Email:Provider` | `Email__Provider` | `Resend` في الإنتاج (إلزامي)، `Development` يسجّل الرمز في اللوج محليًا فقط |
| `Admin:Email` | `Admin__Email` | `rivalshpoe@gmail.com` — البريد الوحيد المسموح له بالدخول |
| `Spaces:*` | `Spaces__*` | مفاتيح DigitalOcean Spaces + CDN عند `Storage:Provider=Spaces` |

## البريد (Resend) — مُهيَّأ ومُختبر

مفتاح Resend مخزَّن الآن في User Secrets على هذا الجهاز، ولا يوجد في أي ملف داخل الريبو (تم التحقق بفحص نصي على الريبويين). استُخدم لإرسال رسالة اختبار فعلية إلى `rivalshpoe@gmail.com` ونجحت.

- يُستخدم المفتاح في مسار واحد فقط: إرسال رمز تحقق الأدمن عبر `ResendEmailSender` (`Resend:ApiKey` → رأس `Authorization: Bearer`). لا يُسجَّل في اللوج ولا يظهر في أي استجابة API.
- المرسِل الحالي `onboarding@resend.dev` وهو نطاق اختبار من Resend: يسمح بالإرسال إلى بريد صاحب الحساب فقط. للإرسال إلى أي بريد آخر يجب توثيق نطاقك في Resend ثم تغيير `Resend:From` إلى `no-reply@<نطاقك>`.
- محليًا يبقى `Email:Provider=Development` (الرمز يُسجَّل في اللوج) لتسهيل الاختبار؛ للتبديل إلى الإرسال الحقيقي:

```powershell
dotnet user-secrets set "Email:Provider" "Resend" --project src/Store.Api
```

في الإنتاج التطبيق يرفض الإقلاع إذا كان `Email:Provider=Development`.

## أوامر التطوير

```powershell
cd C:\Users\NTC\OneDrive\Desktop\Rival-Backend
dotnet user-secrets list --project src/Store.Api                      # أسماء وقيم الأسرار المحلية
dotnet user-secrets set "Jwt:Secret" "<value>" --project src/Store.Api
dotnet user-secrets remove "Resend:ApiKey" --project src/Store.Api
```

## تدوير الأسرار

1. أنشئ القيمة الجديدة (مفتاح Resend جديد من لوحة Resend، أو `openssl rand -base64 48` للمفاتيح المحلية).
2. حدّث `/opt/rival/.env` على السيرفر (أو User Secrets محليًا).
3. `docker compose up -d` لإعادة تشغيل الحاوية بالقيم الجديدة.
4. أبطل المفتاح القديم من لوحة المزوّد.
5. تدوير `Jwt:Secret` يُبطل كل جلسات الأدمن الحالية (متوقع، تُسجَّل الدخول مرة أخرى).

**تنبيه:** أي مفتاح شاركته في محادثة أو لقطة شاشة يُعدّ مكشوفًا. إن كان هذا ينطبق على مفتاح Resend الحالي، أنشئ مفتاحًا جديدًا من لوحة Resend واحذف القديم، ثم نفّذ خطوات التدوير أعلاه.
