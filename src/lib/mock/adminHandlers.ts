/**
 * Mock implementations of EVERY admin endpoint in `docs/api-contract-addendum.md`.
 * Each handler returns exactly the `data` payload the real API returns and
 * throws `AppError` with the contract's error codes on failure.
 */
import { AppError } from "@/lib/api/errors";
import { generateUuid } from "@/lib/utils/generateUuid";
import type { ApiListData } from "@/types/api.types";
import type {
  AdminAnalyticsQuery,
  AdminAnalyticsSummary,
  AdminAuditLog,
  AdminBlockDeviceRequest,
  AdminBrand,
  AdminBrandInput,
  AdminCategory,
  AdminCategoryInput,
  AdminCollectOrdersRequest,
  AdminCollectOrdersResponse,
  AdminDeliveryZone,
  AdminDeliveryZoneInput,
  AdminDevice,
  AdminDevicesQuery,
  AdminDiscountCode,
  AdminDiscountCodeInput,
  AdminInventoryHistoryQuery,
  AdminInventoryQuery,
  AdminInventoryRow,
  AdminMeResponse,
  AdminNotification,
  AdminNotificationsQuery,
  AdminOrderDetails,
  AdminOrderRow,
  AdminOrdersQuery,
  AdminPageQuery,
  AdminPolicy,
  AdminPolicyInput,
  AdminProductDetails,
  AdminProductInput,
  AdminProductRow,
  AdminProductsQuery,
  AdminRefreshResponse,
  AdminRequestOtpRequest,
  AdminRequestOtpResponse,
  AdminRestockRequest,
  AdminRestockResponse,
  AdminReview,
  AdminReviewInput,
  AdminReviewsQuery,
  AdminUpdateOrderStatusRequest,
  AdminUploadResponse,
  AdminVerifyOtpRequest,
  AdminVerifyOtpResponse,
  InventoryLog,
  PolicyKey,
} from "@/types/admin.types";
import { mockDelay, paginate } from "./adapter";
import {
  loadAdminDb,
  saveAdminDb,
  thumbnailFor,
  type AdminMockDb,
  type OrderRecord,
  type ProductRecord,
} from "./adminData";

const ADMIN_EMAIL = "rivalshpoe@gmail.com";
const DEMO_OTP = "123456";
const EDIT_WINDOW_MS = 30 * 86_400_000;
const LOW_STOCK_THRESHOLD = 5;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------
const db = (): AdminMockDb => loadAdminDb();
const commit = (): void => saveAdminDb(db());
const nowIso = (): string => new Date().toISOString();

function notFound(message: string): never {
  throw new AppError("NOT_FOUND", message, null, 404);
}
function validation(message: string, fieldErrors?: Record<string, string>): never {
  throw new AppError("VALIDATION_ERROR", message, null, 422, fieldErrors);
}
function conflict(code: "CONFLICT" | "INVOICE_LOCKED", message: string): never {
  throw new AppError(code, message, null, 409);
}

function audit(action: string, entityType: string, entityId: string): void {
  db().auditLogs.unshift({
    id: generateUuid(),
    adminEmail: ADMIN_EMAIL,
    action,
    entityType,
    entityId,
    ipAddress: "127.0.0.1",
    createdAt: nowIso(),
  });
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function ensureUniqueSlug(slug: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(slug)) return slug;
  let index = 2;
  while (set.has(`${slug}-${index}`)) index += 1;
  return `${slug}-${index}`;
}

function descendantIds(categoryId: string): Set<string> {
  const ids = new Set<string>([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    db().categories.forEach((category) => {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    });
  }
  return ids;
}

function isDiscountActive(product: ProductRecord, now = Date.now()): boolean {
  if (product.discountPrice === null || product.discountPrice >= product.price) return false;
  if (product.discountStartAt && new Date(product.discountStartAt).getTime() > now) return false;
  if (product.discountEndAt && new Date(product.discountEndAt).getTime() < now) return false;
  return true;
}

function totalStock(product: ProductRecord): number {
  return product.hasSizes
    ? product.sizes.reduce((sum, size) => sum + size.stock, 0)
    : product.stock;
}

function liveProducts(): ProductRecord[] {
  return db().products.filter((product) => !product.isDeleted);
}

function toProductRow(product: ProductRecord): AdminProductRow {
  const category = db().categories.find((candidate) => candidate.id === product.categoryId);
  const brand = db().brands.find((candidate) => candidate.id === product.brandId);
  const primary = [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    primaryImageUrl: primary?.url ?? "",
    categoryId: product.categoryId,
    categoryName: category?.name ?? "—",
    brandName: brand?.name ?? null,
    price: product.price,
    discountPrice: product.discountPrice,
    isDiscountActive: isDiscountActive(product),
    hasSizes: product.hasSizes,
    totalStock: totalStock(product),
    isActive: product.isActive,
    createdAt: product.createdAt,
  };
}

function toProductDetails(product: ProductRecord): AdminProductDetails {
  const category = db().categories.find((candidate) => candidate.id === product.categoryId);
  const brand = db().brands.find((candidate) => candidate.id === product.brandId) ?? null;
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: category?.name ?? "—",
    categorySlug: category?.slug ?? "",
    brandId: product.brandId,
    brand: brand ? { id: brand.id, name: brand.name, slug: brand.slug } : null,
    price: product.price,
    discountPrice: product.discountPrice,
    discountStartAt: product.discountStartAt,
    discountEndAt: product.discountEndAt,
    isDiscountActive: isDiscountActive(product),
    hasSizes: product.hasSizes,
    stock: product.hasSizes ? totalStock(product) : product.stock,
    sizes: [...product.sizes],
    colors: [...product.colors],
    images: [...product.images].sort((a, b) => a.sortOrder - b.sortOrder),
    isActive: product.isActive,
    relatedProductIds: liveProducts()
      .filter((candidate) => candidate.categoryId === product.categoryId && candidate.id !== product.id)
      .slice(0, 4)
      .map((candidate) => candidate.id),
    createdAt: product.createdAt,
  };
}

function whatsAppNumber(order: OrderRecord): string {
  return `${order.whatsAppCountryCode}${order.phoneNumber.replace(/\D/g, "").replace(/^0+/, "")}`;
}

function toOrderRow(order: OrderRecord): AdminOrderRow {
  return {
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    customerName: order.customerName,
    phoneNumber: order.phoneNumber,
    whatsAppCountryCode: order.whatsAppCountryCode,
    total: order.total,
    status: order.status,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    isCollected: order.isCollected,
    createdAt: order.createdAt,
  };
}

function toOrderDetails(order: OrderRecord): AdminOrderDetails {
  const editableUntil = new Date(new Date(order.createdAt).getTime() + EDIT_WINDOW_MS);
  const device = db().devices.find((candidate) => candidate.id === order.deviceId);
  return {
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    status: order.status,
    customerName: order.customerName,
    phoneNumber: order.phoneNumber,
    whatsAppCountryCode: order.whatsAppCountryCode,
    whatsAppNumber: whatsAppNumber(order),
    address: order.address,
    needsDelivery: order.needsDelivery,
    deliveryZoneName: order.deliveryZoneName,
    subtotal: order.subtotal,
    discountCode: order.discountCode,
    discountAmount: order.discountAmount,
    deliveryFee: order.deliveryFee,
    total: order.total,
    isCollected: order.isCollected,
    collectedAt: order.collectedAt,
    createdAt: order.createdAt,
    editableUntil: editableUntil.toISOString(),
    canEdit: Date.now() < editableUntil.getTime(),
    device: {
      id: order.deviceId,
      isBlocked: device?.isBlocked ?? false,
      fakeOrderCount: device?.fakeOrderCount ?? 0,
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      productTitle: item.productTitle,
      productImageUrl: item.productImageUrl,
      sizeLabel: item.sizeLabel,
      colorName: item.colorName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  };
}

function isSale(order: OrderRecord): boolean {
  return order.status !== "Fake" && order.status !== "Cancelled";
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveProductNotifications(productId: string, stock: number): void {
  if (stock <= LOW_STOCK_THRESHOLD) return;
  db().notifications.forEach((notification) => {
    if (notification.relatedProductId === productId && notification.type !== "NewOrder") {
      notification.isResolved = true;
    }
  });
}

function pushInventoryLog(product: ProductRecord, sizeId: string | null, log: Omit<InventoryLog, "id" | "createdAt">): void {
  db().inventoryLogs.unshift({
    id: generateUuid(),
    createdAt: nowIso(),
    productId: product.id,
    sizeId,
    ...log,
  });
}

async function fileToWebpDataUrl(file: File, maxSize: number): Promise<string> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new AppError("INTERNAL_ERROR", "تعذّر معالجة الصورة.", null, 500);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
export const adminHandlers = {
  // ----- Auth -----
  async requestOtp(request: AdminRequestOtpRequest): Promise<AdminRequestOtpResponse> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
      validation("البريد الإلكتروني غير صالح.", { email: "البريد الإلكتروني غير صالح." });
    }
    return mockDelay({ success: true, expiresInSeconds: 300, resendAvailableInSeconds: 60 }, 400);
  },

  async verifyOtp(request: AdminVerifyOtpRequest): Promise<AdminVerifyOtpResponse> {
    await mockDelay(null, 450);
    if (request.code !== DEMO_OTP) {
      throw new AppError("UNAUTHORIZED", "الرمز غير صحيح أو انتهت صلاحيته.", null, 401);
    }
    audit("Login", "Session", request.email);
    commit();
    return { success: true, accessToken: `demo-token-${Date.now()}`, expiresIn: 3600 };
  },

  async refresh(): Promise<AdminRefreshResponse> {
    return mockDelay({ accessToken: `demo-token-${Date.now()}`, expiresIn: 3600 }, 120);
  },

  async logout(): Promise<void> {
    audit("Logout", "Session", "—");
    commit();
    await mockDelay(null, 120);
  },

  async me(): Promise<AdminMeResponse> {
    return mockDelay({ email: ADMIN_EMAIL }, 120);
  },

  // ----- Categories -----
  async listCategories(): Promise<AdminCategory[]> {
    const products = liveProducts();
    const items = db().categories.map((category) => {
      const ids = descendantIds(category.id);
      return {
        ...category,
        productCount: products.filter((product) => ids.has(product.categoryId)).length,
      };
    });
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ar"));
    return mockDelay(items);
  },

  async createCategory(input: AdminCategoryInput): Promise<AdminCategory> {
    if (input.name.trim().length < 2) validation("اسم القسم قصير جدًا.", { name: "أدخل اسمًا من حرفين على الأقل." });
    if (input.parentId && !db().categories.some((category) => category.id === input.parentId)) {
      validation("القسم الرئيسي غير موجود.", { parentId: "اختر قسمًا رئيسيًا صالحًا." });
    }
    const id = generateUuid();
    const slug = ensureUniqueSlug(slugify(input.slug ?? input.name, id.slice(0, 8)), db().categories.map((c) => c.slug));
    db().categories.push({
      id,
      name: input.name.trim(),
      slug,
      imageUrl: input.imageUrl,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    audit("CreateCategory", "Category", id);
    commit();
    return mockDelay({ ...db().categories.find((c) => c.id === id)!, productCount: 0 });
  },

  async updateCategory(id: string, input: AdminCategoryInput): Promise<AdminCategory> {
    const category = db().categories.find((candidate) => candidate.id === id) ?? notFound("القسم غير موجود.");
    if (input.name.trim().length < 2) validation("اسم القسم قصير جدًا.", { name: "أدخل اسمًا من حرفين على الأقل." });
    if (input.parentId === id) validation("لا يمكن أن يكون القسم أبًا لنفسه.", { parentId: "اختر قسمًا آخر." });
    const slug = input.slug
      ? ensureUniqueSlug(slugify(input.slug, category.slug), db().categories.filter((c) => c.id !== id).map((c) => c.slug))
      : category.slug;
    Object.assign(category, {
      name: input.name.trim(),
      slug,
      imageUrl: input.imageUrl,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    audit("UpdateCategory", "Category", id);
    commit();
    const ids = descendantIds(id);
    return mockDelay({ ...category, productCount: liveProducts().filter((p) => ids.has(p.categoryId)).length });
  },

  async deleteCategory(id: string): Promise<void> {
    const category = db().categories.find((candidate) => candidate.id === id) ?? notFound("القسم غير موجود.");
    category.isActive = false;
    db().categories.forEach((child) => {
      if (child.parentId === id) child.isActive = false;
    });
    audit("DeleteCategory", "Category", id);
    commit();
    await mockDelay(null);
  },

  // ----- Brands -----
  async listBrands(): Promise<AdminBrand[]> {
    return mockDelay([...db().brands].sort((a, b) => a.name.localeCompare(b.name, "ar")));
  },

  async createBrand(input: AdminBrandInput): Promise<AdminBrand> {
    if (input.name.trim().length < 2) validation("اسم الماركة قصير جدًا.", { name: "أدخل اسمًا من حرفين على الأقل." });
    const id = generateUuid();
    const brand: AdminBrand = {
      id,
      name: input.name.trim(),
      slug: ensureUniqueSlug(slugify(input.slug ?? input.name, id.slice(0, 8)), db().brands.map((b) => b.slug)),
      imageUrl: input.imageUrl,
    };
    db().brands.push(brand);
    audit("CreateBrand", "Brand", id);
    commit();
    return mockDelay(brand);
  },

  async updateBrand(id: string, input: AdminBrandInput): Promise<AdminBrand> {
    const brand = db().brands.find((candidate) => candidate.id === id) ?? notFound("الماركة غير موجودة.");
    if (input.name.trim().length < 2) validation("اسم الماركة قصير جدًا.", { name: "أدخل اسمًا من حرفين على الأقل." });
    brand.name = input.name.trim();
    brand.imageUrl = input.imageUrl;
    if (input.slug) brand.slug = ensureUniqueSlug(slugify(input.slug, brand.slug), db().brands.filter((b) => b.id !== id).map((b) => b.slug));
    audit("UpdateBrand", "Brand", id);
    commit();
    return mockDelay(brand);
  },

  async deleteBrand(id: string): Promise<void> {
    const index = db().brands.findIndex((candidate) => candidate.id === id);
    if (index < 0) notFound("الماركة غير موجودة.");
    db().brands.splice(index, 1);
    db().products.forEach((product) => {
      if (product.brandId === id) product.brandId = null;
    });
    audit("DeleteBrand", "Brand", id);
    commit();
    await mockDelay(null);
  },

  // ----- Products -----
  async listProducts(query: AdminProductsQuery = {}): Promise<ApiListData<AdminProductRow>> {
    let items = liveProducts();
    if (query.categoryId) {
      const ids = descendantIds(query.categoryId);
      items = items.filter((product) => ids.has(product.categoryId));
    }
    if (typeof query.isActive === "boolean") items = items.filter((product) => product.isActive === query.isActive);
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((product) => product.title.toLowerCase().includes(needle) || product.slug.includes(needle) || product.id.includes(needle));
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockDelay(paginate(items.map(toProductRow), query.page, query.pageSize));
  },

  async getProduct(id: string): Promise<AdminProductDetails> {
    const product = liveProducts().find((candidate) => candidate.id === id) ?? notFound("المنتج غير موجود.");
    return mockDelay(toProductDetails(product));
  },

  async createProduct(input: AdminProductInput): Promise<AdminProductDetails> {
    validateProductInput(input);
    const id = generateUuid();
    const product: ProductRecord = {
      id,
      title: input.title.trim(),
      slug: ensureUniqueSlug(slugify(input.title, id.slice(0, 8)), db().products.map((p) => p.slug)),
      description: input.description.trim(),
      categoryId: input.categoryId,
      brandId: input.brandId,
      price: input.price,
      discountPrice: input.discountPrice,
      discountStartAt: input.discountStartAt,
      discountEndAt: input.discountEndAt,
      hasSizes: input.hasSizes,
      stock: input.hasSizes ? 0 : input.stock,
      sizes: input.hasSizes ? input.sizes.map((size) => ({ id: generateUuid(), label: size.label.trim(), price: size.price, stock: size.stock })) : [],
      colors: input.colors.map((color) => ({ id: generateUuid(), name: color.name.trim(), hex: color.hex })),
      images: input.imageUrls.map((url, index) => ({ id: generateUuid(), url, thumbnailUrl: thumbnailFor(url), isPrimary: index === 0, sortOrder: index + 1 })),
      isActive: input.isActive,
      isDeleted: false,
      createdAt: nowIso(),
    };
    db().products.unshift(product);
    if (product.hasSizes) {
      product.sizes.filter((size) => size.stock > 0).forEach((size) => pushInventoryLog(product, size.id, { changeType: "Restock", quantityChanged: size.stock, stockAfter: size.stock, note: "مخزون أولي" }));
    } else if (product.stock > 0) {
      pushInventoryLog(product, null, { changeType: "Restock", quantityChanged: product.stock, stockAfter: product.stock, note: "مخزون أولي" });
    }
    audit("CreateProduct", "Product", id);
    commit();
    return mockDelay(toProductDetails(product));
  },

  async updateProduct(id: string, input: AdminProductInput): Promise<AdminProductDetails> {
    const product = liveProducts().find((candidate) => candidate.id === id) ?? notFound("المنتج غير موجود.");
    validateProductInput(input);
    product.title = input.title.trim();
    product.description = input.description.trim();
    product.categoryId = input.categoryId;
    product.brandId = input.brandId;
    product.price = input.price;
    product.discountPrice = input.discountPrice;
    product.discountStartAt = input.discountStartAt;
    product.discountEndAt = input.discountEndAt;
    product.hasSizes = input.hasSizes;
    product.isActive = input.isActive;
    product.colors = input.colors.map((color) => ({ id: color.id ?? generateUuid(), name: color.name.trim(), hex: color.hex }));
    product.images = input.imageUrls.map((url, index) => {
      const existing = product.images.find((image) => image.url === url);
      return { id: existing?.id ?? generateUuid(), url, thumbnailUrl: existing?.thumbnailUrl ?? thumbnailFor(url), isPrimary: index === 0, sortOrder: index + 1 };
    });
    if (input.hasSizes) {
      const previous = new Map(product.sizes.map((size) => [size.id, size.stock]));
      product.sizes = input.sizes.map((size) => ({ id: size.id ?? generateUuid(), label: size.label.trim(), price: size.price, stock: size.stock }));
      product.stock = 0;
      product.sizes.forEach((size) => {
        const before = previous.get(size.id) ?? 0;
        if (before === size.stock) return;
        const diff = size.stock - before;
        pushInventoryLog(product, size.id, { changeType: diff > 0 ? "Restock" : "Sale", quantityChanged: diff, stockAfter: size.stock, note: "تعديل من نموذج المنتج" });
      });
    } else {
      product.sizes = [];
      if (product.stock !== input.stock) {
        const diff = input.stock - product.stock;
        product.stock = input.stock;
        pushInventoryLog(product, null, { changeType: diff > 0 ? "Restock" : "Sale", quantityChanged: diff, stockAfter: input.stock, note: "تعديل من نموذج المنتج" });
      }
    }
    audit("UpdateProduct", "Product", id);
    commit();
    return mockDelay(toProductDetails(product));
  },

  async deleteProduct(id: string): Promise<void> {
    const product = liveProducts().find((candidate) => candidate.id === id) ?? notFound("المنتج غير موجود.");
    product.isDeleted = true;
    product.isActive = false;
    audit("DeleteProduct", "Product", id);
    commit();
    await mockDelay(null);
  },

  // ----- Uploads -----
  async uploadImage(file: File): Promise<AdminUploadResponse> {
    if (!file.type.startsWith("image/")) validation("الملف ليس صورة صالحة.", { file: "اختر ملف صورة (PNG/JPG/WebP)." });
    if (file.size > MAX_UPLOAD_BYTES) validation("حجم الصورة أكبر من 5MB.", { file: "الحد الأقصى لحجم الصورة 5MB." });
    const [url, thumbnailUrl] = await Promise.all([fileToWebpDataUrl(file, 1200), fileToWebpDataUrl(file, 320)]);
    await mockDelay(null, 500);
    return { url, thumbnailUrl };
  },

  // ----- Orders -----
  async listOrders(query: AdminOrdersQuery = {}): Promise<ApiListData<AdminOrderRow>> {
    let items = [...db().orders];
    if (query.status) items = items.filter((order) => order.status === query.status);
    if (typeof query.isCollected === "boolean") items = items.filter((order) => order.isCollected === query.isCollected);
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((order) => order.invoiceNumber.toLowerCase().includes(needle) || order.customerName.toLowerCase().includes(needle) || order.phoneNumber.includes(needle));
    }
    if (query.from) items = items.filter((order) => dayKey(order.createdAt) >= query.from!);
    if (query.to) items = items.filter((order) => dayKey(order.createdAt) <= query.to!);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockDelay(paginate(items.map(toOrderRow), query.page, query.pageSize));
  },

  async getOrder(id: string): Promise<AdminOrderDetails> {
    const order = db().orders.find((candidate) => candidate.id === id) ?? notFound("الطلب غير موجود.");
    return mockDelay(toOrderDetails(order));
  },

  async updateOrderStatus(id: string, request: AdminUpdateOrderStatusRequest): Promise<AdminOrderDetails> {
    const order = db().orders.find((candidate) => candidate.id === id) ?? notFound("الطلب غير موجود.");
    if (!toOrderDetails(order).canEdit) conflict("INVOICE_LOCKED", "انتهت مهلة تعديل هذه الفاتورة (30 يومًا).");
    const previous = order.status;
    order.status = request.status;
    const device = db().devices.find((candidate) => candidate.id === order.deviceId);
    if (device) {
      if (request.status === "Fake" && previous !== "Fake") device.fakeOrderCount += 1;
      if (request.status !== "Fake" && previous === "Fake") device.fakeOrderCount = Math.max(0, device.fakeOrderCount - 1);
    }
    db().notifications.forEach((notification) => {
      if (notification.relatedOrderId === id) notification.isResolved = true;
    });
    audit(`UpdateOrderStatus:${request.status}`, "Order", id);
    commit();
    return mockDelay(toOrderDetails(order));
  },

  async collectOrders(request: AdminCollectOrdersRequest): Promise<AdminCollectOrdersResponse> {
    const notFoundList: string[] = [];
    let collectedCount = 0;
    let collectedAmount = 0;
    const seen = new Set<string>();
    request.invoiceNumbers.forEach((raw) => {
      const invoice = raw.trim().toUpperCase();
      if (!invoice || seen.has(invoice)) return;
      seen.add(invoice);
      const order = db().orders.find((candidate) => candidate.invoiceNumber.toUpperCase() === invoice && isSale(candidate));
      if (!order) {
        notFoundList.push(raw.trim());
        return;
      }
      if (!order.isCollected) {
        order.isCollected = true;
        order.collectedAt = nowIso();
        collectedCount += 1;
        collectedAmount += order.total;
        audit("CollectOrder", "Order", order.id);
      }
    });
    commit();
    return mockDelay({ collectedCount, collectedAmount, notFound: notFoundList }, 400);
  },

  async listCollectedOrders(query: AdminPageQuery = {}): Promise<ApiListData<AdminOrderRow>> {
    const items = db().orders
      .filter((order) => order.isCollected)
      .sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? ""));
    return mockDelay(paginate(items.map(toOrderRow), query.page, query.pageSize));
  },

  // ----- Delivery zones -----
  async listDeliveryZones(): Promise<AdminDeliveryZone[]> {
    return mockDelay([...db().deliveryZones]);
  },

  async createDeliveryZone(input: AdminDeliveryZoneInput): Promise<AdminDeliveryZone> {
    if (input.name.trim().length < 2) validation("اسم المنطقة قصير جدًا.", { name: "أدخل اسمًا من حرفين على الأقل." });
    const zone: AdminDeliveryZone = { id: generateUuid(), name: input.name.trim(), extraFee: input.extraFee, isActive: input.isActive };
    db().deliveryZones.push(zone);
    audit("CreateDeliveryZone", "DeliveryZone", zone.id);
    commit();
    return mockDelay(zone);
  },

  async updateDeliveryZone(id: string, input: AdminDeliveryZoneInput): Promise<AdminDeliveryZone> {
    const zone = db().deliveryZones.find((candidate) => candidate.id === id) ?? notFound("منطقة التوصيل غير موجودة.");
    if (input.name.trim().length < 2) validation("اسم المنطقة قصير جدًا.", { name: "أدخل اسمًا من حرفين على الأقل." });
    Object.assign(zone, { name: input.name.trim(), extraFee: input.extraFee, isActive: input.isActive });
    audit("UpdateDeliveryZone", "DeliveryZone", id);
    commit();
    return mockDelay(zone);
  },

  async deleteDeliveryZone(id: string): Promise<void> {
    const index = db().deliveryZones.findIndex((candidate) => candidate.id === id);
    if (index < 0) notFound("منطقة التوصيل غير موجودة.");
    db().deliveryZones.splice(index, 1);
    audit("DeleteDeliveryZone", "DeliveryZone", id);
    commit();
    await mockDelay(null);
  },

  // ----- Discount codes -----
  async listDiscountCodes(): Promise<AdminDiscountCode[]> {
    const now = Date.now();
    return mockDelay(
      db().discountCodes.map((code) => ({
        ...code,
        isCurrentlyValid: code.isActive && new Date(code.startAt).getTime() <= now && new Date(code.endAt).getTime() >= now,
      })),
    );
  },

  async createDiscountCode(input: AdminDiscountCodeInput): Promise<AdminDiscountCode> {
    validateDiscountInput(input);
    const code = input.code.trim().toUpperCase();
    if (db().discountCodes.some((candidate) => candidate.code === code)) conflict("CONFLICT", "هذا الكود مستخدم بالفعل.");
    const record = { id: generateUuid(), code, percentageOff: input.percentageOff, startAt: input.startAt, endAt: input.endAt, isActive: input.isActive, usageCount: 0 };
    db().discountCodes.unshift(record);
    audit("CreateDiscountCode", "DiscountCode", record.id);
    commit();
    return (await adminHandlers.listDiscountCodes()).find((candidate) => candidate.id === record.id)!;
  },

  async updateDiscountCode(id: string, input: AdminDiscountCodeInput): Promise<AdminDiscountCode> {
    const record = db().discountCodes.find((candidate) => candidate.id === id) ?? notFound("كود الخصم غير موجود.");
    validateDiscountInput(input);
    const code = input.code.trim().toUpperCase();
    if (db().discountCodes.some((candidate) => candidate.code === code && candidate.id !== id)) conflict("CONFLICT", "هذا الكود مستخدم بالفعل.");
    Object.assign(record, { code, percentageOff: input.percentageOff, startAt: input.startAt, endAt: input.endAt, isActive: input.isActive });
    audit("UpdateDiscountCode", "DiscountCode", id);
    commit();
    return (await adminHandlers.listDiscountCodes()).find((candidate) => candidate.id === id)!;
  },

  async deleteDiscountCode(id: string): Promise<void> {
    const index = db().discountCodes.findIndex((candidate) => candidate.id === id);
    if (index < 0) notFound("كود الخصم غير موجود.");
    db().discountCodes.splice(index, 1);
    audit("DeleteDiscountCode", "DiscountCode", id);
    commit();
    await mockDelay(null);
  },

  // ----- Inventory -----
  async listInventory(query: AdminInventoryQuery = {}): Promise<ApiListData<AdminInventoryRow>> {
    const threshold = Math.max(0, query.threshold ?? LOW_STOCK_THRESHOLD);
    const logs = db().inventoryLogs;
    const rows: AdminInventoryRow[] = liveProducts().flatMap((product) => {
      const primary = product.images[0]?.url ?? "";
      const targets = product.hasSizes
        ? product.sizes.map((size) => ({ sizeId: size.id, sizeLabel: size.label, stock: size.stock }))
        : [{ sizeId: null, sizeLabel: null, stock: product.stock }];
      return targets.map(({ sizeId, sizeLabel, stock }) => {
        const lastLog = logs.find((log) => log.productId === product.id && log.sizeId === sizeId);
        return {
          productId: product.id,
          productTitle: product.title,
          primaryImageUrl: primary,
          sizeId,
          sizeLabel,
          stock,
          isLow: stock > 0 && stock <= threshold,
          isDepleted: stock === 0,
          lastChangeAt: lastLog?.createdAt ?? product.createdAt,
        };
      });
    });
    const filtered = query.lowStockOnly ? rows.filter((row) => row.isLow || row.isDepleted) : rows;
    filtered.sort((a, b) => Number(b.isDepleted) - Number(a.isDepleted) || Number(b.isLow) - Number(a.isLow) || a.stock - b.stock);
    return mockDelay(paginate(filtered, query.page, query.pageSize));
  },

  async restockInventory(request: AdminRestockRequest): Promise<AdminRestockResponse> {
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) validation("الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.", { quantity: "أدخل كمية أكبر من صفر." });
    const product = liveProducts().find((candidate) => candidate.id === request.productId) ?? notFound("المنتج غير موجود.");
    let stock: number;
    if (request.sizeId) {
      const size = product.sizes.find((candidate) => candidate.id === request.sizeId) ?? notFound("المقاس غير موجود.");
      size.stock += request.quantity;
      stock = size.stock;
    } else {
      product.stock += request.quantity;
      stock = product.stock;
    }
    pushInventoryLog(product, request.sizeId, { changeType: "Restock", quantityChanged: request.quantity, stockAfter: stock, note: request.note });
    resolveProductNotifications(product.id, totalStock(product));
    audit("Restock", "Product", product.id);
    commit();
    return mockDelay({ productId: product.id, sizeId: request.sizeId, stock });
  },

  async getInventoryHistory(productId: string, query: AdminInventoryHistoryQuery = {}): Promise<ApiListData<InventoryLog>> {
    if (!db().products.some((candidate) => candidate.id === productId)) notFound("المنتج غير موجود.");
    const items = db().inventoryLogs
      .filter((log) => log.productId === productId && (!query.sizeId || log.sizeId === query.sizeId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((log): InventoryLog => ({
        id: log.id,
        changeType: log.changeType,
        quantityChanged: log.quantityChanged,
        stockAfter: log.stockAfter,
        note: log.note,
        createdAt: log.createdAt,
      }));
    return mockDelay(paginate(items, query.page, query.pageSize ?? 20));
  },

  // ----- Devices -----
  async listDevices(query: AdminDevicesQuery = {}): Promise<ApiListData<AdminDevice>> {
    const items = db().devices
      .filter((device) => !query.blockedOnly || device.isBlocked)
      .sort((a, b) => b.fakeOrderCount - a.fakeOrderCount || (b.lastOrderAt ?? "").localeCompare(a.lastOrderAt ?? ""));
    return mockDelay(paginate(items, query.page, query.pageSize));
  },

  async setDeviceBlocked(id: string, request: AdminBlockDeviceRequest): Promise<AdminDevice> {
    const device = db().devices.find((candidate) => candidate.id === id) ?? notFound("الجهاز غير موجود.");
    device.isBlocked = request.isBlocked;
    device.blockedAt = request.isBlocked ? nowIso() : null;
    device.blockedReason = request.isBlocked ? request.reason : null;
    audit(request.isBlocked ? "BlockDevice" : "UnblockDevice", "Device", id);
    commit();
    return mockDelay(device);
  },

  // ----- Notifications -----
  async listNotifications(query: AdminNotificationsQuery = {}): Promise<ApiListData<AdminNotification>> {
    const items = db().notifications
      .filter((notification) => !query.unresolvedOnly || !notification.isResolved)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockDelay(paginate(items, query.page, query.pageSize), 120);
  },

  async resolveNotification(id: string): Promise<AdminNotification> {
    const notification = db().notifications.find((candidate) => candidate.id === id) ?? notFound("الإشعار غير موجود.");
    notification.isResolved = true;
    audit("ResolveNotification", "Notification", id);
    commit();
    return mockDelay(notification);
  },

  // ----- Analytics -----
  async getAnalyticsSummary(query: AdminAnalyticsQuery = {}): Promise<AdminAnalyticsSummary> {
    const orders = db().orders.filter((order) => (!query.from || dayKey(order.createdAt) >= query.from) && (!query.to || dayKey(order.createdAt) <= query.to));
    const sales = orders.filter(isSale);
    const today = dayKey(nowIso());
    const products = liveProducts();
    const stocks = products.map(totalStock);

    const days = 14;
    const salesByDay = Array.from({ length: days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - index));
      const key = dayKey(date.toISOString());
      const dayOrders = sales.filter((order) => dayKey(order.createdAt) === key);
      return { date: key, total: dayOrders.reduce((sum, order) => sum + order.total, 0), count: dayOrders.length };
    });

    const top = new Map<string, { title: string; quantity: number; revenue: number }>();
    sales.forEach((order) => order.items.forEach((item) => {
      const entry = top.get(item.productId) ?? { title: item.productTitle, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += item.lineTotal;
      top.set(item.productId, entry);
    }));
    const topProducts = [...top.entries()]
      .map(([productId, entry]) => ({ productId, ...entry }))
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 6);

    const collected = sales.filter((order) => order.isCollected);
    const summary: AdminAnalyticsSummary = {
      ordersCount: orders.length,
      pendingCount: orders.filter((order) => order.status === "Pending").length,
      confirmedCount: orders.filter((order) => order.status === "Confirmed").length,
      cancelledCount: orders.filter((order) => order.status === "Cancelled").length,
      fakeCount: orders.filter((order) => order.status === "Fake").length,
      totalSold: sales.reduce((sum, order) => sum + order.total, 0),
      totalCollected: collected.reduce((sum, order) => sum + order.total, 0),
      totalUncollected: sales.filter((order) => !order.isCollected).reduce((sum, order) => sum + order.total, 0),
      productsCount: products.length,
      lowStockCount: stocks.filter((stock) => stock > 0 && stock <= LOW_STOCK_THRESHOLD).length,
      depletedCount: stocks.filter((stock) => stock === 0).length,
      todayOrders: orders.filter((order) => dayKey(order.createdAt) === today).length,
      todaySales: sales.filter((order) => dayKey(order.createdAt) === today).reduce((sum, order) => sum + order.total, 0),
      salesByDay,
      topProducts,
    };
    return mockDelay(summary, 260);
  },

  // ----- Policies -----
  async listPolicies(): Promise<AdminPolicy[]> {
    return mockDelay([...db().policies]);
  },

  async updatePolicy(key: PolicyKey, input: AdminPolicyInput): Promise<AdminPolicy> {
    const policy = db().policies.find((candidate) => candidate.key === key) ?? notFound("السياسة غير موجودة.");
    if (input.title.trim().length < 2) validation("العنوان قصير جدًا.", { title: "أدخل عنوانًا من حرفين على الأقل." });
    if (input.content.trim().length < 10) validation("المحتوى قصير جدًا.", { content: "أدخل محتوى من 10 أحرف على الأقل." });
    policy.title = input.title.trim();
    policy.content = input.content.trim();
    policy.updatedAt = nowIso();
    audit("UpdatePolicy", "Policy", key);
    commit();
    return mockDelay(policy);
  },

  // ----- Reviews -----
  async listReviews(query: AdminReviewsQuery = {}): Promise<ApiListData<AdminReview>> {
    const items = db().reviews
      .filter((review) => !query.approvedOnly || review.isApproved)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toReview);
    return mockDelay(paginate(items, query.page, query.pageSize));
  },

  async createReview(input: AdminReviewInput): Promise<AdminReview> {
    validateReviewInput(input);
    const record = { id: generateUuid(), createdAt: nowIso(), ...normalizeReviewInput(input) };
    db().reviews.unshift(record);
    audit("CreateReview", "Review", record.id);
    commit();
    return mockDelay(toReview(record));
  },

  async updateReview(id: string, input: AdminReviewInput): Promise<AdminReview> {
    const record = db().reviews.find((candidate) => candidate.id === id) ?? notFound("التقييم غير موجود.");
    validateReviewInput(input);
    Object.assign(record, normalizeReviewInput(input));
    audit("UpdateReview", "Review", id);
    commit();
    return mockDelay(toReview(record));
  },

  async deleteReview(id: string): Promise<void> {
    const index = db().reviews.findIndex((candidate) => candidate.id === id);
    if (index < 0) notFound("التقييم غير موجود.");
    db().reviews.splice(index, 1);
    audit("DeleteReview", "Review", id);
    commit();
    await mockDelay(null);
  },

  async approveReview(id: string, isApproved: boolean): Promise<AdminReview> {
    const record = db().reviews.find((candidate) => candidate.id === id) ?? notFound("التقييم غير موجود.");
    record.isApproved = isApproved;
    audit(isApproved ? "ApproveReview" : "UnapproveReview", "Review", id);
    commit();
    return mockDelay(toReview(record));
  },

  // ----- Audit logs -----
  async listAuditLogs(query: AdminPageQuery = {}): Promise<ApiListData<AdminAuditLog>> {
    const items = [...db().auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return mockDelay(paginate(items, query.page, query.pageSize ?? 20));
  },
};

export type AdminHandlers = typeof adminHandlers;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function validateProductInput(input: AdminProductInput): void {
  const errors: Record<string, string> = {};
  if (input.title.trim().length < 3) errors.title = "اسم المنتج يجب أن يتكون من 3 أحرف على الأقل.";
  if (!db().categories.some((category) => category.id === input.categoryId)) errors.categoryId = "اختر قسمًا صالحًا.";
  if (input.brandId && !db().brands.some((brand) => brand.id === input.brandId)) errors.brandId = "الماركة غير موجودة.";
  if (!(input.price > 0)) errors.price = "أدخل سعرًا أكبر من صفر.";
  if (input.discountPrice !== null && input.discountPrice >= input.price) errors.discountPrice = "سعر الخصم يجب أن يكون أقل من السعر الأصلي.";
  if (input.discountStartAt && input.discountEndAt && input.discountStartAt > input.discountEndAt) errors.discountEndAt = "تاريخ نهاية الخصم يجب أن يكون بعد البداية.";
  if (input.hasSizes && !input.sizes.length) errors.sizes = "أضف مقاسًا واحدًا على الأقل.";
  if (!input.hasSizes && (!Number.isInteger(input.stock) || input.stock < 0)) errors.stock = "أدخل كمية صحيحة.";
  if (!input.imageUrls.length) errors.imageUrls = "أضف صورة واحدة على الأقل.";
  if (Object.keys(errors).length) validation("يرجى مراجعة البيانات المدخلة.", errors);
}

function validateDiscountInput(input: AdminDiscountCodeInput): void {
  const errors: Record<string, string> = {};
  if (!/^[A-Z0-9_-]{3,20}$/i.test(input.code.trim())) errors.code = "الكود من 3 إلى 20 حرفًا/رقمًا لاتينيًا.";
  if (!(input.percentageOff >= 1 && input.percentageOff <= 100)) errors.percentageOff = "النسبة بين 1 و100.";
  if (!input.startAt || !input.endAt) errors.endAt = "حدد تاريخ البداية والنهاية.";
  else if (new Date(input.startAt).getTime() >= new Date(input.endAt).getTime()) errors.endAt = "تاريخ النهاية يجب أن يكون بعد البداية.";
  if (Object.keys(errors).length) validation("يرجى مراجعة البيانات المدخلة.", errors);
}

function validateReviewInput(input: AdminReviewInput): void {
  const errors: Record<string, string> = {};
  if (input.customerName.trim().length < 2) errors.customerName = "أدخل اسم العميل.";
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.rating = "التقييم بين 1 و5.";
  if (input.comment.trim().length < 3) errors.comment = "أدخل نص التقييم.";
  if (input.productId && !db().products.some((product) => product.id === input.productId)) errors.productId = "المنتج غير موجود.";
  if (Object.keys(errors).length) validation("يرجى مراجعة البيانات المدخلة.", errors);
}

function normalizeReviewInput(input: AdminReviewInput) {
  return {
    customerName: input.customerName.trim(),
    rating: input.rating,
    comment: input.comment.trim(),
    imageUrl: input.imageUrl,
    productId: input.productId,
    isApproved: input.isApproved,
  };
}

function toReview(record: AdminMockDb["reviews"][number]): AdminReview {
  const product = record.productId ? db().products.find((candidate) => candidate.id === record.productId) : null;
  return { ...record, productTitle: product?.title ?? null };
}
