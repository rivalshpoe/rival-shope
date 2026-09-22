# نشر Rival على DigitalOcean

هذا الدليل ينشر الواجهة (Next.js) والـ API (.NET 10) وPostgreSQL وRedis على Droplet واحد باستخدام Docker Compose. الأسرار لا تُرفع إلى Git أبدًا، والدخول إلى السيرفر يتم بمفتاح SSH فقط.

## 0. الوضع الحالي على هذا الجهاز

- مفتاح الدخول إلى السيرفر موجود ومحمي خارج المشروع: `%USERPROFILE%\.ssh\rival_do_ed25519` (الخاص) و`rival_do_ed25519.pub` (العام).
- المفتاح العام مسجّل في حساب DigitalOcean باسم `rival-deploy` (ID `59513724`).
- مفتاح GitHub منفصل: `%USERPROFILE%\.ssh\rival_github_ed25519`. لا يُستخدم لدخول السيرفر.
- حساب `doctl` الحالي (`shallsara2006@gmail.com` / My Team) **لا يحتوي أي Droplet**. لا يُنشأ سيرفر مدفوع تلقائيًا من هذا المستودع.

إذا كانت لوحة `cloud.digitalocean.com` التي فتحتها فريقًا آخر، ثبّت `doctl` عليه قبل المتابعة:

```powershell
doctl auth init --context rival
doctl auth switch --context rival
doctl compute ssh-key list
```

إن لم يظهر `rival-deploy`، ارفع المفتاح **العام فقط**:

```powershell
doctl compute ssh-key import rival-deploy --public-key-file "$env:USERPROFILE\.ssh\rival_do_ed25519.pub"
```

## 1. إنشاء السيرفر (مرة واحدة)

Ubuntu 24.04، المنطقة `fra1`، والحجم الأصغر المناسب للتجربة `s-2vcpu-4gb` (2 vCPU / 4 GB). غيّر الحجم إذا زاد الحمل. المفتاح هو `rival-deploy` فقط — لا تُفعّل الدخول بكلمة مرور.

```powershell
doctl compute droplet create rival-shop `
  --region fra1 `
  --size s-2vcpu-4gb `
  --image ubuntu-24-04-x64 `
  --ssh-keys 59513724 `
  --enable-monitoring `
  --wait
doctl compute droplet list --format ID,Name,PublicIPv4,Status
```

سجّل عنوان IPv4، ثم في `%USERPROFILE%\.ssh\config` استبدل `DROPLET_IP` به. بعدها:

```powershell
ssh rival-do
```

## 2. قفل السيرفر

على السيرفر، كـ root:

```bash
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
# الصق سطر المفتاح العام فقط (rival_do_ed25519.pub)
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
usermod -aG sudo deploy

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

في `/etc/ssh/sshd_config`:

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
```

ثم `systemctl reload ssh`. من هذه اللحظة الدخول هو:

```powershell
ssh rival-do
```

لا تفتح المنفذ 5432 ولا 6379 للإنترنت. Postgres وRedis يبقيان على شبكة Docker الداخلية.

## 3. تثبيت Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
```

سجّل خروجًا ثم ادخل من جديد حتى تُطبَّق مجموعة `docker`.

## 4. الأسرار على السيرفر فقط

```bash
sudo mkdir -p /opt/rival
sudo chown deploy:deploy /opt/rival
chmod 700 /opt/rival
nano /opt/rival/.env
chmod 600 /opt/rival/.env
```

أنشئ القيم على جهازك ثم انسخها. لا تكتبها في المستودع:

```powershell
# 48 بايت لسر JWT ومفتاح HMAC
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
# 32 بايت لمفتاح AES-256
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

محتوى `/opt/rival/.env` (بدون علامات اقتباس زائدة):

```
POSTGRES_PASSWORD=<openssl-rand>
ConnectionStrings__Postgres=Host=postgres;Port=5432;Database=rival;Username=rival_app;Password=<POSTGRES_PASSWORD>;SSL Mode=Disable;Maximum Pool Size=100;Minimum Pool Size=5;Timeout=15;Command Timeout=30;Include Error Detail=false
Redis__ConnectionString=redis:6379,abortConnect=false
Jwt__Secret=<48-byte-base64>
Jwt__Issuer=rival-api
Jwt__Audience=rival-admin
Security__DeviceHmacKey=<48-byte-base64>
Security__AesKey=<32-byte-base64>
Resend__ApiKey=<من لوحة Resend، ليس من Git>
Resend__From=Rival <onboarding@resend.dev>
Email__Provider=Resend
Admin__Email=rivalshpoe@gmail.com
Cors__AllowedOrigins__0=https://YOUR_DOMAIN
Storage__Provider=Local
ASPNETCORE_ENVIRONMENT=Production
Database__AutoMigrate=true
```

كلمة مرور Postgres هنا خاصة بالحاوية. بعد أول إقلاع طبّق `db/security/02-grant-privileges.sql` حتى يعمل التطبيق بدور `rival_app` (DML فقط) ويبقى دور المالك للـ Migrations. خطوات الأدوار في `docs/DATABASE.md`.

مفتاح Resend على هذا الجهاز موجود فقط في .NET User Secrets، خارج المستودع. انسخه إلى `.env` على السيرفر يدويًا ولا تلصقه في أمر يظهر في سجل الطرفية المشترك.

## 5. تشغيل الحاويات

على السيرفر، داخل `/opt/rival`:

```bash
git clone git@github.com:rivalshpoe/rival-shope.git app
cd app
docker compose -f docker-compose.prod.yml --env-file /opt/rival/.env up -d --build
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8080/api/v1/health
```

الصحة يجب أن تعيد Postgres وRedis بحالة سليمة. Swagger لا يعمل في الإنتاج.

## 6. النطاق و TLS

ثبّت Caddy (يحصل على شهادة Let's Encrypt وحده):

```bash
sudo apt-get install -y caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
your-domain.com {
  reverse_proxy 127.0.0.1:3000
}
api.your-domain.com {
  reverse_proxy 127.0.0.1:8080
}
EOF
sudo systemctl reload caddy
```

وجّه سجلَّي DNS من نوع A إلى IPv4 السيرفر. بعد صدور الشهادة حدّث `Cors__AllowedOrigins__0` و`NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com/api/v1` ثم أعد بناء الواجهة.

## 7. النسخ الاحتياطي

`db/backup/pg_backup.sh` يعمل كل 6 ساعات من cron لمستخدم `deploy`، ويكتب نسخة `pg_dump` مضغوطة ومشفّرة بـ GPG. جرّب `pg_restore.sh` على قاعدة `rival_restore_test` قبل أن تعتمد النسخة. لا تعطِ دور النسخ الاحتياطي صلاحية قراءة `AdminUsers` و`RefreshTokens` و`Devices` (مطبّق في سكربت الصلاحيات).

## 8. التحديث

```bash
cd /opt/rival/app
git pull
docker compose -f docker-compose.prod.yml --env-file /opt/rival/.env up -d --build
curl -fsS http://127.0.0.1:8080/api/v1/health
```

تدوير سر: عدّل `/opt/rival/.env` ثم أعد إنشاء حاوية الـ API فقط. تدوير `Jwt__Secret` يُنهي جلسات الأدمن الحالية، وهذا متوقع. afterward أبطل المفتاح القديم من لوحة Resend أو من مزوّد القاعدة.

## 9. ما لا يُفعل

- لا ترفع `.env` أو `secrets.json` أو أي مفتاح خاص (`*.pem`, `id_*` بدون `.pub`).
- لا تفتح Postgres أو Redis على عنوان عام.
- لا تستخدم `Email__Provider=Development` في الإنتاج؛ التطبيق يرفض الإقلاع.
- لا تضع مفتاح Resend في أمر `docker compose` ظاهر داخل سجل CI عام. استخدم ملف `.env` بصلاحية `600` أو متغيّرات `SECRET` في App Platform.
