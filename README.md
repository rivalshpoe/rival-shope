# Rival Storefront

واجهة متجر عربية فاخرة مبنية بـ Next.js وTypeScript، ومهيأة للاتصال لاحقًا بباك إند مستقل عبر REST API.

## التشغيل المحلي

```bash
npm install
copy .env.local.example .env.local
npm run dev
```

ثم افتح `http://localhost:3000`.

تعمل النسخة الحالية ببيانات تجريبية عند تفعيل:

```env
NEXT_PUBLIC_USE_MOCK_API=true
```

## Docker

```bash
docker compose up --build
```

يتطلب ذلك تثبيت Docker Desktop وتشغيله.

## أوامر التحقق

```bash
npm run typecheck
npm run lint
npm run build
```

## لوحة الإدارة التجريبية

المسار غير المعلن: `/mgmt-portal-x7k9`

تسجيل الدخول في وضع العرض يستخدم رمز OTP تجريبيًا توضحه شاشة الدخول. لا تُستخدم هذه الآلية في الإنتاج؛ عند ربط الباك إند تعتمد الجلسة على Cookie من نوع `HttpOnly + Secure + SameSite=Strict`.
