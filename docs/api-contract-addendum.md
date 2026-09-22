# ملحق عقد الـ API — Rival (مشترك بين الفرونت والباك)

> يكمّل هذا الملحق "عقد الـ API الموحّد" في ملفَي frontend-prompt و backend-prompt ولا يعارضه. أي نقطة غير مذكورة هنا أو هناك لا تُنفَّذ. كل المسارات تحت `/api/v1`. كل نجاح: `{ "success": true, "data": ... }`. كل قائمة: `data = { items, pagination }`. كل خطأ: `{ success:false, errorCode, message, correlationId, fieldErrors? }`.

## أكواد الأخطاء (errorCode)
`VALIDATION_ERROR`(422) `NOT_FOUND`(404) `UNAUTHORIZED`(401) `FORBIDDEN`(403) `CONFLICT`(409) `OUT_OF_STOCK`(409) `INVOICE_LOCKED`(409) `DUPLICATE_REQUEST`(409) `RATE_LIMITED`(429) `DEVICE_BLOCKED`(429) `BAD_REQUEST`(400) `SEARCH_TOO_LONG`(400) `INTERNAL_ERROR`(500) `SERVICE_UNAVAILABLE`(503) `EMAIL_FAILED`(502)

## عام (Public)
| المسار | Method | الرد `data` |
|---|---|---|
| `/categories` | GET | `Category[]` = `{ id, name, slug, imageUrl, parentId, sortOrder, isActive, productCount }` |
| `/brands` | GET | `Brand[]` = `{ id, name, slug, imageUrl }` |
| `/products` | GET | قائمة `ProductListItem` (العقد) + حقول إضافية `brandId, brandName, brandSlug`. Query إضافية: `categorySlug?, brandId?, brandSlug?, search?` |
| `/products/{id}` | GET | `ProductDetails` (العقد) + `slug, brand:{id,name,slug}|null, categoryName, categorySlug` |
| `/search?q=&page=&pageSize=` | GET | قائمة `ProductListItem`. `q` ≤ 100 حرف وإلا 400 `SEARCH_TOO_LONG` |
| `/delivery-zones` | GET | `{ id, name, extraFee, isActive }[]` (النشطة فقط) |
| `/discount-codes/validate` | POST | العقد |
| `/orders` | POST | العقد. Headers `X-Device-Fingerprint`, `Idempotency-Key` |
| `/policies` | GET | `Policy[]` = `{ key, title, content, updatedAt }` — المفاتيح: `order, cancellation, returns, shipping, privacy` |
| `/policies/{key}` | GET | `Policy` |
| `/reviews?productId?&page&pageSize` | GET | قائمة `Review` = `{ id, customerName, rating(1-5), comment, imageUrl|null, productId|null, productTitle|null, createdAt }` (المعتمدة فقط) |
| `/health` | GET | `{ status:"Healthy", checks:{ postgres, redis } }` |

## الأدمن (JWT Bearer + Role=Admin) — `/admin/...`
### المصادقة
- `POST /admin/auth/request-otp` `{email}` → `{ success, expiresInSeconds, resendAvailableInSeconds }`
- `POST /admin/auth/verify-otp` `{email, code}` → `{ success:true, accessToken, expiresIn }` + Cookie `rival_refresh` (HttpOnly Secure SameSite=Strict, 7 أيام)
- `POST /admin/auth/refresh` (Cookie) → `{ accessToken, expiresIn }` مع تدوير الكوكي
- `POST /admin/auth/logout` → يمسح الكوكي
- `GET /admin/auth/me` → `{ email }`

### الكتالوج
- `GET /admin/categories` → `Category[]` (تشمل غير النشطة)
- `POST /admin/categories` `{ name, slug?, imageUrl, parentId|null, sortOrder, isActive }` → `Category`
- `PUT /admin/categories/{id}` نفس الجسم → `Category`
- `DELETE /admin/categories/{id}` → Soft Delete (`isActive=false`)
- `GET|POST|PUT|DELETE /admin/brands` `{ name, slug?, imageUrl }`
- `GET /admin/products?page&pageSize&search&categoryId&isActive` → قائمة `AdminProductRow` = `{ id, title, slug, primaryImageUrl, categoryId, categoryName, brandName, price, discountPrice, isDiscountActive, hasSizes, totalStock, isActive, createdAt }`
- `GET /admin/products/{id}` → `AdminProductDetails` = `ProductDetails` + `{ brandId, discountStartAt, discountEndAt, isActive, sizes:[{id,label,price,stock}], images:[{id,url,thumbnailUrl,isPrimary,sortOrder}] }`
- `POST /admin/products` `{ title, description, categoryId, brandId|null, price, discountPrice|null, discountStartAt|null, discountEndAt|null, hasSizes, stock, sizes:[{label,price,stock}], colors:[{name,hex}], imageUrls:[string] (الأولى = الرئيسية), isActive }` → `AdminProductDetails`
- `PUT /admin/products/{id}` نفس الجسم (+ `sizes[].id?`, `colors[].id?`)
- `DELETE /admin/products/{id}` → Soft Delete
- `POST /admin/uploads/images` multipart حقل `file` (≤5MB، صورة فعلية بالـ Magic Bytes) → `{ url, thumbnailUrl }` (WebP دائمًا)

### الطلبات
- `GET /admin/orders?status?&search?&from?&to?&isCollected?&page&pageSize` → قائمة `AdminOrderRow` = `{ id, invoiceNumber, customerName, phoneNumber, whatsAppCountryCode, total, status, itemCount, isCollected, createdAt }`
- `GET /admin/orders/{id}` → `AdminOrderDetails` = `{ id, invoiceNumber, status, customerName, phoneNumber, whatsAppCountryCode, whatsAppNumber("970599..."), address, needsDelivery, deliveryZoneName, subtotal, discountCode, discountAmount, deliveryFee, total, isCollected, collectedAt, createdAt, editableUntil, canEdit, device:{ id, isBlocked, fakeOrderCount }, items:[{ productId, productTitle, productImageUrl, sizeLabel, colorName, quantity, unitPrice, lineTotal }] }`
- `PATCH /admin/orders/{id}/status` `{ status: "Confirmed"|"Cancelled"|"Fake" }` → `AdminOrderDetails`. خارج نافذة 30 يومًا → 409 `INVOICE_LOCKED`
- `PATCH /admin/orders/collect` `{ invoiceNumbers:[...] }` → `{ collectedCount, collectedAmount, notFound:[...] }`
- `GET /admin/orders/collected?page&pageSize` → قائمة `AdminOrderRow`

### التوصيل والخصومات
- `GET|POST|PUT|DELETE /admin/delivery-zones` `{ name, extraFee|null, isActive }`
- `GET|POST|PUT|DELETE /admin/discount-codes` `{ code, percentageOff(1-100), startAt(UTC ISO), endAt(UTC ISO), isActive }` → + `usageCount, isCurrentlyValid`

### المخزون
- `GET /admin/inventory?lowStockOnly?&threshold=5&page&pageSize` → قائمة `{ productId, productTitle, primaryImageUrl, sizeId|null, sizeLabel|null, stock, isLow, isDepleted, lastChangeAt }`
- `POST /admin/inventory/restock` `{ productId, sizeId|null, quantity(>0), note|null }` → `{ productId, sizeId, stock }`
- `GET /admin/inventory/{productId}/history?sizeId?&page&pageSize` → قائمة `InventoryLog` = `{ id, changeType:"Sale"|"Restock"|"Depleted"|"Return", quantityChanged, stockAfter, note, createdAt }`

### الأجهزة والإشعارات والتحليلات
- `GET /admin/devices?blockedOnly?&page&pageSize` → `{ id, maskedHash, fakeOrderCount, totalOrders, isBlocked, blockedAt, blockedReason, lastOrderAt }`
- `PATCH /admin/devices/{id}/block` `{ isBlocked, reason|null }`
- `GET /admin/notifications?unresolvedOnly=true&page&pageSize` → `{ id, type:"NewOrder"|"LowStock"|"Depleted", title, message, relatedOrderId, relatedProductId, isResolved, createdAt }` — إشعار الطلب يُحل تلقائيًا عند تغيير حالته
- `PATCH /admin/notifications/{id}/resolve`
- `GET /admin/analytics/summary?from?&to?` → `{ ordersCount, pendingCount, confirmedCount, cancelledCount, fakeCount, totalSold, totalCollected, totalUncollected, productsCount, lowStockCount, depletedCount, todayOrders, todaySales, salesByDay:[{date,total,count}], topProducts:[{productId,title,quantity,revenue}] }` (الوهمية مستبعدة من المبيعات)

### المحتوى
- `GET /admin/policies` → `Policy[]`; `PUT /admin/policies/{key}` `{ title, content }` → `Policy`
- `GET /admin/reviews?page&pageSize&approvedOnly?` → قائمة `Review` + `isApproved`
- `POST /admin/reviews` `{ customerName, rating, comment, imageUrl|null, productId|null, isApproved }`
- `PUT /admin/reviews/{id}`, `DELETE /admin/reviews/{id}`, `PATCH /admin/reviews/{id}/approve` `{ isApproved }`
- `GET /admin/audit-logs?page&pageSize` → `{ id, adminEmail, action, entityType, entityId, ipAddress, createdAt }`
