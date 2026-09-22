/**
 * In-memory + `safeStorage`-persisted mock database for the admin dashboard.
 *
 * Products / categories / brands / reviews / delivery zones / discount codes are
 * seeded READ-ONLY from `./data`; nothing here mutates those arrays. Any shape
 * differences are normalised defensively so concurrent changes to `./data`
 * do not break the admin seed.
 */
import { safeGetJson, safeSetJson, safeStorage } from "@/lib/utils/safeStorage";
import type {
  AdminAuditLog,
  AdminBrand,
  AdminDeliveryZone,
  AdminDevice,
  AdminDiscountCode,
  AdminNotification,
  AdminOrderStatus,
  AdminPolicy,
  AdminProductColor,
  AdminProductImage,
  AdminProductSize,
  AdminReview,
  InventoryLog,
} from "@/types/admin.types";
import {
  mockBrands,
  mockCategories,
  mockDeliveryZones,
  mockDiscountCodes,
  mockPolicies,
  mockProductDetails,
  mockProducts,
  mockReviews,
} from "./data";

// ---------------------------------------------------------------------------
// Stored record shapes (computed fields are derived in adminHandlers)
// ---------------------------------------------------------------------------
export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string | null;
  price: number;
  discountPrice: number | null;
  discountStartAt: string | null;
  discountEndAt: string | null;
  hasSizes: boolean;
  stock: number;
  sizes: AdminProductSize[];
  colors: AdminProductColor[];
  images: AdminProductImage[];
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface OrderItemRecord {
  productId: string;
  productTitle: string;
  productImageUrl: string;
  sizeId: string | null;
  sizeLabel: string | null;
  colorName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderRecord {
  id: string;
  invoiceNumber: string;
  status: AdminOrderStatus;
  customerName: string;
  phoneNumber: string;
  whatsAppCountryCode: "970" | "972";
  address: string | null;
  needsDelivery: boolean;
  deliveryZoneName: string | null;
  subtotal: number;
  discountCode: string | null;
  discountAmount: number;
  deliveryFee: number;
  total: number;
  isCollected: boolean;
  collectedAt: string | null;
  createdAt: string;
  deviceId: string;
  items: OrderItemRecord[];
}

export interface InventoryLogRecord extends InventoryLog {
  productId: string;
  sizeId: string | null;
}

export type DiscountCodeRecord = Omit<AdminDiscountCode, "isCurrentlyValid">;
export type ReviewRecord = Omit<AdminReview, "productTitle">;

export interface AdminMockDb {
  version: number;
  seededAt: string;
  categories: CategoryRecord[];
  brands: AdminBrand[];
  products: ProductRecord[];
  orders: OrderRecord[];
  devices: AdminDevice[];
  notifications: AdminNotification[];
  inventoryLogs: InventoryLogRecord[];
  auditLogs: AdminAuditLog[];
  discountCodes: DiscountCodeRecord[];
  deliveryZones: AdminDeliveryZone[];
  policies: AdminPolicy[];
  reviews: ReviewRecord[];
}

export const ADMIN_DB_STORAGE_KEY = "rival-admin-mock-db";
const DB_VERSION = 3;
const RESEED_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const picsum = (seed: string, w = 900, h = 1100) =>
  `https://picsum.photos/seed/rival-${seed}/${w}/${h}`;

export function thumbnailFor(url: string): string {
  return url.replace(/\/(\d+)\/(\d+)$/, "/300/360");
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function nullableNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function at(daysAgo: number, hour = 10, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Seed: categories (from ./data + local sub-category fallbacks)
// ---------------------------------------------------------------------------
function seedCategories(): CategoryRecord[] {
  const main = (mockCategories as unknown[]).map((raw, index) => {
    const c = rec(raw);
    return {
      id: str(c.id, `cat-${index + 1}`),
      name: str(c.name, `قسم ${index + 1}`),
      slug: str(c.slug, `category-${index + 1}`),
      imageUrl: str(c.imageUrl, picsum(`cat-${index + 1}`)),
      parentId: typeof c.parentId === "string" ? c.parentId : null,
      sortOrder: num(c.sortOrder, index + 1),
      isActive: bool(c.isActive, true),
    } satisfies CategoryRecord;
  });

  const subFallbacks: CategoryRecord[] = [
    { id: "cat-shape-waist", name: "مشدات خصر", slug: "waist-shapers", imageUrl: picsum("waist"), parentId: "cat-shape", sortOrder: 1, isActive: true },
    { id: "cat-shape-full", name: "مشدات جسم كامل", slug: "full-body-shapers", imageUrl: picsum("fullbody"), parentId: "cat-shape", sortOrder: 2, isActive: true },
    { id: "cat-bags-shoulder", name: "حقائب كتف", slug: "shoulder-bags", imageUrl: picsum("shoulder"), parentId: "cat-bags", sortOrder: 1, isActive: true },
    { id: "cat-bags-clutch", name: "حقائب يد صغيرة", slug: "clutch-bags", imageUrl: picsum("clutch"), parentId: "cat-bags", sortOrder: 2, isActive: false },
  ];
  const ids = new Set(main.map((c) => c.id));
  const subs = subFallbacks.filter((sub) => ids.has(sub.parentId ?? "") && !ids.has(sub.id));
  return [...main, ...subs];
}

// ---------------------------------------------------------------------------
// Seed: brands
// ---------------------------------------------------------------------------
function seedBrands(): AdminBrand[] {
  return (mockBrands as unknown[]).map((raw, index) => {
    const b = rec(raw);
    const slug = str(b.slug, `brand-${index + 1}`);
    return {
      id: str(b.id, `brand-${slug}`),
      name: str(b.name, slug),
      slug,
      imageUrl: str(b.imageUrl, str(b.logoUrl, picsum(slug, 600, 600))),
    };
  });
}

// ---------------------------------------------------------------------------
// Seed: products (details from ./data)
// ---------------------------------------------------------------------------
function brandIdForSlug(slug: string, brands: AdminBrand[]): string | null {
  const match = brands.find((brand) => slug.startsWith(`${brand.slug}-`) || slug.includes(brand.slug));
  return match?.id ?? null;
}

function seedProducts(brands: AdminBrand[]): ProductRecord[] {
  const listById = new Map<string, Record<string, unknown>>();
  (mockProducts as unknown[]).forEach((raw) => {
    const p = rec(raw);
    if (typeof p.id === "string") listById.set(p.id, p);
  });

  const details = mockProductDetails as unknown[];
  return details.map((raw, index) => {
    const d = rec(raw);
    const id = str(d.id, `prod-${String(index + 1).padStart(2, "0")}`);
    const list = listById.get(id) ?? {};
    const slug = str(list.slug, str(d.slug, id));
    const price = num(d.price, num(list.price, 100));
    const discountPrice = nullableNum(d.discountPrice ?? list.discountPrice);

    const rawImages = Array.isArray(d.images) ? (d.images as unknown[]) : [];
    const images: AdminProductImage[] = rawImages.map((imageRaw, imageIndex) => {
      const img = rec(imageRaw);
      const url = str(img.url, picsum(`${slug}-${imageIndex}`));
      return {
        id: `${id}-img-${imageIndex + 1}`,
        url,
        thumbnailUrl: str(img.thumbnailUrl, thumbnailFor(url)),
        isPrimary: imageIndex === 0,
        sortOrder: imageIndex + 1,
      };
    });
    if (!images.length) {
      const url = str(list.primaryImageUrl, picsum(slug));
      images.push({ id: `${id}-img-1`, url, thumbnailUrl: thumbnailFor(url), isPrimary: true, sortOrder: 1 });
    }

    const rawSizes = Array.isArray(d.sizes) ? (d.sizes as unknown[]) : [];
    const sizes: AdminProductSize[] = rawSizes.map((sizeRaw, sizeIndex) => {
      const s = rec(sizeRaw);
      const label = str(s.label, ["S", "M", "L", "XL"][sizeIndex] ?? `S${sizeIndex}`);
      const inStock = bool(s.inStock, true);
      return {
        id: str(s.id, `${id}-${label.toLowerCase()}`),
        label,
        price: num(s.price, price),
        stock: typeof s.stock === "number" ? s.stock : inStock ? 3 + ((index + sizeIndex) % 6) : 0,
      };
    });

    const rawColors = Array.isArray(d.colors) ? (d.colors as unknown[]) : [];
    const colors: AdminProductColor[] = rawColors.map((colorRaw, colorIndex) => {
      const c = rec(colorRaw);
      return {
        id: str(c.id, `${id}-color-${colorIndex + 1}`),
        name: str(c.name, `لون ${colorIndex + 1}`),
        hex: str(c.hex, "#111111"),
      };
    });

    const hasSizes = sizes.length > 0 || bool(list.hasSizes, false);
    // Deterministic but varied stock so the inventory page shows low/depleted rows.
    const baseStock = [12, 4, 0, 18, 2, 25, 7, 0, 9, 14, 3, 21, 6, 11][index % 14];

    return {
      id,
      title: str(d.title, str(list.title, `منتج ${index + 1}`)),
      slug,
      description: str(d.description, ""),
      categoryId: id === "prod-08" ? "cat-shape-waist" : str(d.categoryId, str(list.categoryId, "cat-general")),
      brandId: brandIdForSlug(slug, brands),
      price,
      discountPrice,
      discountStartAt: discountPrice !== null ? at(10, 0) : null,
      discountEndAt: discountPrice !== null ? at(-20, 23, 59) : null,
      hasSizes,
      stock: hasSizes ? 0 : baseStock,
      sizes,
      colors,
      images,
      isActive: index !== 13,
      isDeleted: false,
      createdAt: at(40 - index * 2, 9),
    };
  });
}

// ---------------------------------------------------------------------------
// Seed: devices, orders, notifications, inventory logs, audit logs
// ---------------------------------------------------------------------------
function seedDevices(): AdminDevice[] {
  return [
    { id: "device-1", maskedHash: "a1b2…9f3c", fakeOrderCount: 0, totalOrders: 3, isBlocked: false, blockedAt: null, blockedReason: null, lastOrderAt: at(0, 9, 12) },
    { id: "device-2", maskedHash: "d4e5…77b0", fakeOrderCount: 0, totalOrders: 2, isBlocked: false, blockedAt: null, blockedReason: null, lastOrderAt: at(1, 14, 20) },
    { id: "device-3", maskedHash: "0c9a…e21d", fakeOrderCount: 2, totalOrders: 4, isBlocked: false, blockedAt: null, blockedReason: null, lastOrderAt: at(2, 20, 5) },
    { id: "device-4", maskedHash: "f00d…b33f", fakeOrderCount: 3, totalOrders: 3, isBlocked: true, blockedAt: at(3, 11), blockedReason: "ثلاثة طلبات وهمية متكررة", lastOrderAt: at(3, 10, 40) },
    { id: "device-5", maskedHash: "7e7e…1a1a", fakeOrderCount: 0, totalOrders: 1, isBlocked: false, blockedAt: null, blockedReason: null, lastOrderAt: at(6, 17, 30) },
  ];
}

interface OrderSeed {
  n: number;
  daysAgo: number;
  hour: number;
  status: AdminOrderStatus;
  customer: string;
  phone: string;
  cc: "970" | "972";
  deviceId: string;
  zone: string | null;
  fee: number;
  address: string | null;
  discountCode: string | null;
  discountPct: number;
  collectedDaysAgo: number | null;
  items: Array<[productId: string, qty: number, sizeIndex: number | null, colorIndex: number | null]>;
}

function buildOrder(seed: OrderSeed, products: ProductRecord[]): OrderRecord {
  const items: OrderItemRecord[] = seed.items.flatMap(([productId, quantity, sizeIndex, colorIndex]) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return [];
    const size = sizeIndex !== null ? product.sizes[sizeIndex] ?? null : null;
    const color = colorIndex !== null ? product.colors[colorIndex] ?? null : null;
    const unitPrice = size ? size.price : product.discountPrice ?? product.price;
    return [{
      productId,
      productTitle: product.title,
      productImageUrl: product.images[0]?.url ?? "",
      sizeId: size?.id ?? null,
      sizeLabel: size?.label ?? null,
      colorName: color?.name ?? null,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    }];
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = Math.round(subtotal * (seed.discountPct / 100));
  const created = new Date(at(seed.daysAgo, seed.hour, (seed.n * 7) % 60));
  const yy = String(created.getFullYear()).slice(-2);
  const mm = String(created.getMonth() + 1).padStart(2, "0");
  const dd = String(created.getDate()).padStart(2, "0");
  return {
    id: `order-${seed.n}`,
    invoiceNumber: `RIV-${yy}${mm}${dd}-${String(seed.n).padStart(3, "0")}`,
    status: seed.status,
    customerName: seed.customer,
    phoneNumber: seed.phone,
    whatsAppCountryCode: seed.cc,
    address: seed.address,
    needsDelivery: seed.zone !== null,
    deliveryZoneName: seed.zone,
    subtotal,
    discountCode: seed.discountCode,
    discountAmount,
    deliveryFee: seed.fee,
    total: subtotal - discountAmount + seed.fee,
    isCollected: seed.collectedDaysAgo !== null,
    collectedAt: seed.collectedDaysAgo !== null ? at(seed.collectedDaysAgo, 18) : null,
    createdAt: created.toISOString(),
    deviceId: seed.deviceId,
    items,
  };
}

function seedOrders(products: ProductRecord[]): OrderRecord[] {
  const seeds: OrderSeed[] = [
    { n: 1, daysAgo: 0, hour: 9, status: "Pending", customer: "هدى منصور", phone: "0599123456", cc: "970", deviceId: "device-1", zone: "رام الله والبيرة", fee: 20, address: "رام الله، المصايف، شارع الإرسال", discountCode: null, discountPct: 0, collectedDaysAgo: null, items: [["prod-01", 1, null, 0], ["prod-05", 1, null, 0]] },
    { n: 2, daysAgo: 0, hour: 11, status: "Confirmed", customer: "ميس أبو عيشة", phone: "0568456789", cc: "972", deviceId: "device-2", zone: "القدس", fee: 30, address: "القدس، بيت حنينا", discountCode: "RIVAL10", discountPct: 10, collectedDaysAgo: null, items: [["prod-07", 1, 1, 0]] },
    { n: 3, daysAgo: 0, hour: 13, status: "Pending", customer: "رنا خليل", phone: "0598765432", cc: "970", deviceId: "device-3", zone: null, fee: 0, address: null, discountCode: null, discountPct: 0, collectedDaysAgo: null, items: [["prod-09", 2, null, 0]] },
    { n: 4, daysAgo: 1, hour: 10, status: "Confirmed", customer: "لينا خالد", phone: "0569991234", cc: "970", deviceId: "device-1", zone: "شمال الضفة", fee: 35, address: "نابلس، رفيديا", discountCode: null, discountPct: 0, collectedDaysAgo: 0, items: [["prod-03", 1, null, 1]] },
    { n: 5, daysAgo: 1, hour: 16, status: "Fake", customer: "زائر", phone: "0590000000", cc: "970", deviceId: "device-3", zone: "جنوب الضفة", fee: 35, address: "—", discountCode: null, discountPct: 0, collectedDaysAgo: null, items: [["prod-02", 3, null, null]] },
    { n: 6, daysAgo: 2, hour: 12, status: "Confirmed", customer: "نور يوسف", phone: "0597123123", cc: "970", deviceId: "device-2", zone: "رام الله والبيرة", fee: 20, address: "البيرة، شارع القدس", discountCode: null, discountPct: 0, collectedDaysAgo: 1, items: [["prod-11", 1, 2, null], ["prod-09", 1, null, 1]] },
    { n: 7, daysAgo: 2, hour: 19, status: "Cancelled", customer: "ريم عمر", phone: "0568222333", cc: "972", deviceId: "device-5", zone: "القدس", fee: 30, address: "القدس، شعفاط", discountCode: null, discountPct: 0, collectedDaysAgo: null, items: [["prod-06", 1, null, 0]] },
    { n: 8, daysAgo: 3, hour: 9, status: "Fake", customer: "test", phone: "0591111111", cc: "970", deviceId: "device-4", zone: null, fee: 0, address: null, discountCode: null, discountPct: 0, collectedDaysAgo: null, items: [["prod-04", 2, null, 0]] },
    { n: 9, daysAgo: 4, hour: 15, status: "Confirmed", customer: "دانا علي", phone: "0599555666", cc: "970", deviceId: "device-1", zone: "شمال الضفة", fee: 35, address: "جنين، المدينة", discountCode: "RIVAL10", discountPct: 10, collectedDaysAgo: 2, items: [["prod-13", 1, null, 0], ["prod-10", 1, null, 0]] },
    { n: 10, daysAgo: 5, hour: 11, status: "Confirmed", customer: "هبة سامي", phone: "0597777888", cc: "970", deviceId: "device-3", zone: "رام الله والبيرة", fee: 20, address: "رام الله، الطيرة", discountCode: null, discountPct: 0, collectedDaysAgo: 3, items: [["prod-08", 2, 0, 0]] },
    { n: 11, daysAgo: 6, hour: 17, status: "Confirmed", customer: "سارة أحمد", phone: "0568999000", cc: "972", deviceId: "device-2", zone: "القدس", fee: 30, address: "القدس، الشيخ جراح", discountCode: null, discountPct: 0, collectedDaysAgo: null, items: [["prod-12", 1, 1, null]] },
    { n: 12, daysAgo: 8, hour: 10, status: "Confirmed", customer: "جنى خليل", phone: "0599333444", cc: "970", deviceId: "device-5", zone: null, fee: 0, address: null, discountCode: null, discountPct: 0, collectedDaysAgo: 6, items: [["prod-01", 1, null, 1]] },
    { n: 13, daysAgo: 10, hour: 14, status: "Cancelled", customer: "أمل حسن", phone: "0597444555", cc: "970", deviceId: "device-3", zone: "جنوب الضفة", fee: 35, address: "الخليل، عين سارة", discountCode: null, discountPct: 0, collectedDaysAgo: null, items: [["prod-14", 1, null, null]] },
    { n: 14, daysAgo: 12, hour: 9, status: "Confirmed", customer: "ليان سمير", phone: "0568111222", cc: "972", deviceId: "device-1", zone: "القدس", fee: 30, address: "القدس، بيت صفافا", discountCode: null, discountPct: 0, collectedDaysAgo: 10, items: [["prod-05", 1, null, 0], ["prod-09", 1, null, 0]] },
    { n: 15, daysAgo: 36, hour: 12, status: "Confirmed", customer: "منى راشد", phone: "0599888777", cc: "970", deviceId: "device-4", zone: "رام الله والبيرة", fee: 20, address: "رام الله، عين مصباح", discountCode: null, discountPct: 0, collectedDaysAgo: 30, items: [["prod-02", 1, null, null]] },
  ];
  return seeds.map((seed) => buildOrder(seed, products)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function seedNotifications(orders: OrderRecord[], products: ProductRecord[]): AdminNotification[] {
  const notifications: AdminNotification[] = [];
  orders.forEach((order) => {
    notifications.push({
      id: `notif-order-${order.id}`,
      type: "NewOrder",
      title: `طلب جديد ${order.invoiceNumber}`,
      message: `${order.customerName} — ${order.items.length} منتج بقيمة ${order.total} ₪`,
      relatedOrderId: order.id,
      relatedProductId: null,
      isResolved: order.status !== "Pending",
      createdAt: order.createdAt,
    });
  });
  products.forEach((product) => {
    if (product.hasSizes) return;
    if (product.stock === 0) {
      notifications.push({ id: `notif-depleted-${product.id}`, type: "Depleted", title: "نفد المخزون", message: `${product.title} لم يعد متوفرًا في المخزون.`, relatedOrderId: null, relatedProductId: product.id, isResolved: false, createdAt: at(1, 8) });
    } else if (product.stock <= 4) {
      notifications.push({ id: `notif-low-${product.id}`, type: "LowStock", title: "مخزون منخفض", message: `تبقّى ${product.stock} قطع فقط من ${product.title}.`, relatedOrderId: null, relatedProductId: product.id, isResolved: false, createdAt: at(0, 7, 30) });
    }
  });
  return notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function seedInventoryLogs(products: ProductRecord[], orders: OrderRecord[]): InventoryLogRecord[] {
  const logs: InventoryLogRecord[] = [];
  let counter = 0;
  products.forEach((product) => {
    const targets = product.hasSizes
      ? product.sizes.map((size) => ({ sizeId: size.id, stock: size.stock }))
      : [{ sizeId: null, stock: product.stock }];
    targets.forEach(({ sizeId, stock }) => {
      const initial = stock + 6;
      logs.push({ id: `inv-${++counter}`, productId: product.id, sizeId, changeType: "Restock", quantityChanged: initial, stockAfter: initial, note: "توريد أولي", createdAt: at(30, 9) });
      let running = initial;
      const sales = orders
        .filter((order) => order.status !== "Fake" && order.status !== "Cancelled")
        .flatMap((order) => order.items.filter((item) => item.productId === product.id && item.sizeId === sizeId).map((item) => ({ item, order })))
        .sort((a, b) => a.order.createdAt.localeCompare(b.order.createdAt));
      sales.forEach(({ item, order }) => {
        running = Math.max(0, running - item.quantity);
        logs.push({ id: `inv-${++counter}`, productId: product.id, sizeId, changeType: "Sale", quantityChanged: -item.quantity, stockAfter: running, note: `طلب ${order.invoiceNumber}`, createdAt: order.createdAt });
      });
      if (running !== stock) {
        const diff = stock - running;
        logs.push({ id: `inv-${++counter}`, productId: product.id, sizeId, changeType: diff > 0 ? "Return" : "Sale", quantityChanged: diff, stockAfter: stock, note: diff > 0 ? "إرجاع من عميل" : "تسوية جرد", createdAt: at(1, 12) });
      }
      if (stock === 0) {
        logs.push({ id: `inv-${++counter}`, productId: product.id, sizeId, changeType: "Depleted", quantityChanged: 0, stockAfter: 0, note: null, createdAt: at(1, 12, 1) });
      }
    });
  });
  return logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function seedAuditLogs(): AdminAuditLog[] {
  const email = "rivalshpoe@gmail.com";
  return [
    { id: "audit-1", adminEmail: email, action: "Login", entityType: "Session", entityId: "—", ipAddress: "185.12.44.10", createdAt: at(0, 8, 2) },
    { id: "audit-2", adminEmail: email, action: "UpdateOrderStatus:Confirmed", entityType: "Order", entityId: "order-2", ipAddress: "185.12.44.10", createdAt: at(0, 11, 30) },
    { id: "audit-3", adminEmail: email, action: "Restock", entityType: "Product", entityId: "prod-01", ipAddress: "185.12.44.10", createdAt: at(1, 9, 45) },
    { id: "audit-4", adminEmail: email, action: "BlockDevice", entityType: "Device", entityId: "device-4", ipAddress: "185.12.44.10", createdAt: at(3, 11) },
    { id: "audit-5", adminEmail: email, action: "UpdatePolicy", entityType: "Policy", entityId: "returns", ipAddress: "185.12.44.10", createdAt: at(4, 15, 10) },
    { id: "audit-6", adminEmail: email, action: "CreateDiscountCode", entityType: "DiscountCode", entityId: "discount-1", ipAddress: "185.12.44.10", createdAt: at(12, 10, 5) },
  ];
}

// ---------------------------------------------------------------------------
// Seed: discount codes, delivery zones, policies, reviews
// ---------------------------------------------------------------------------
function seedDiscountCodes(): DiscountCodeRecord[] {
  const fromData = (mockDiscountCodes as unknown[]).map((raw, index) => {
    const d = rec(raw);
    const percentage = str(d.type, "percentage") === "percentage" ? num(d.percentageOff, num(d.value, 10)) : 10;
    return {
      id: str(d.id, `discount-${index + 1}`),
      code: str(d.code, `CODE${index + 1}`).toUpperCase(),
      percentageOff: Math.min(100, Math.max(1, percentage)),
      startAt: str(d.startAt, at(30, 0)),
      endAt: str(d.endAt, str(d.expiresAt, at(-60, 23, 59))),
      isActive: bool(d.isActive, true),
      usageCount: [48, 12][index] ?? 0,
    } satisfies DiscountCodeRecord;
  });
  const extras: DiscountCodeRecord[] = [
    { id: "discount-expired", code: "SUMMER25", percentageOff: 25, startAt: at(90, 0), endAt: at(20, 23, 59), isActive: true, usageCount: 80 },
    { id: "discount-upcoming", code: "WINTER15", percentageOff: 15, startAt: at(-15, 0), endAt: at(-75, 23, 59), isActive: true, usageCount: 0 },
  ];
  return [...fromData, ...extras];
}

function seedDeliveryZones(): AdminDeliveryZone[] {
  const zones = (mockDeliveryZones as unknown[]).map((raw, index) => {
    const z = rec(raw);
    return {
      id: str(z.id, `zone-${index + 1}`),
      name: str(z.name, `منطقة ${index + 1}`),
      extraFee: "extraFee" in z ? nullableNum(z.extraFee) : nullableNum(z.fee),
      isActive: bool(z.isActive, true),
    } satisfies AdminDeliveryZone;
  });
  return [...zones, { id: "zone-gaza", name: "غزة", extraFee: null, isActive: false }];
}

const POLICY_FALLBACK: AdminPolicy[] = [
  { key: "order", title: "سياسة الطلب", content: "يتم تأكيد الطلبات خلال 24 ساعة عبر واتساب.\nالدفع عند الاستلام.\nيمكن تعديل الطلب قبل تأكيده فقط.", updatedAt: at(20, 12) },
  { key: "cancellation", title: "سياسة الإلغاء", content: "يمكن إلغاء الطلب مجانًا قبل شحنه.\nبعد الشحن تُحتسب رسوم التوصيل.", updatedAt: at(20, 12) },
  { key: "returns", title: "سياسة الإرجاع", content: "يُقبل الإرجاع خلال 3 أيام من الاستلام بشرط سلامة المنتج والتغليف.\nلا يُقبل إرجاع المشدات لأسباب صحية.", updatedAt: at(4, 15, 10) },
  { key: "shipping", title: "سياسة الشحن والتوصيل", content: "التوصيل لجميع مناطق الضفة والقدس خلال 1-4 أيام عمل.\nرسوم التوصيل تُحدد حسب المنطقة وتظهر قبل إتمام الطلب.", updatedAt: at(20, 12) },
  { key: "privacy", title: "سياسة الخصوصية", content: "نستخدم بياناتك لإتمام الطلب والتواصل فقط.\nلا نشارك بياناتك مع أي طرف ثالث.", updatedAt: at(20, 12) },
];

const POLICY_KEYS = new Set<string>(["order", "cancellation", "returns", "shipping", "privacy"]);

function seedPolicies(): AdminPolicy[] {
  const fromData = (mockPolicies as unknown[]).flatMap((raw) => {
    const p = rec(raw);
    const key = str(p.key);
    if (!POLICY_KEYS.has(key)) return [];
    return [{
      key: key as AdminPolicy["key"],
      title: str(p.title, POLICY_FALLBACK.find((policy) => policy.key === key)?.title ?? key),
      content: str(p.content, ""),
      updatedAt: str(p.updatedAt, at(20, 12)),
    } satisfies AdminPolicy];
  });
  return POLICY_FALLBACK.map((fallback) => fromData.find((policy) => policy.key === fallback.key) ?? { ...fallback });
}

function seedReviews(products: ProductRecord[]): ReviewRecord[] {
  const productIds = new Set(products.map((product) => product.id));
  const fromData = (mockReviews as unknown[]).map((raw, index) => {
    const r = rec(raw);
    const productId = typeof r.productId === "string" && productIds.has(r.productId) ? r.productId : null;
    return {
      id: str(r.id, `review-${index + 1}`),
      customerName: str(r.customerName, "عميلة"),
      rating: Math.min(5, Math.max(1, num(r.rating, 5))),
      comment: str(r.comment, ""),
      imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : null,
      productId,
      createdAt: str(r.createdAt, at(5, 10)),
      isApproved: bool(r.isApproved, true),
    } satisfies ReviewRecord;
  });
  const extras: ReviewRecord[] = [
    { id: "review-pending-1", customerName: "ميس حمدان", rating: 5, comment: "الخامة رائعة والتغليف أنيق جدًا. وصلتني بسرعة.", imageUrl: picsum("review-shot-1", 700, 900), productId: "prod-01", createdAt: at(0, 12), isApproved: false },
    { id: "review-pending-2", customerName: "هدى ناصر", rating: 3, comment: "التصميم جميل لكن القياس كان واسعًا قليلًا.", imageUrl: null, productId: "prod-06", createdAt: at(1, 15), isApproved: false },
    { id: "review-general", customerName: "جنى خليل", rating: 5, comment: "تعامل راقٍ وسرعة في التوصيل. أنصح بالمتجر.", imageUrl: picsum("review-shot-2", 700, 900), productId: null, createdAt: at(3, 9), isApproved: true },
  ];
  return [...fromData, ...extras].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function createSeedDb(): AdminMockDb {
  const brands = seedBrands();
  const products = seedProducts(brands);
  const orders = seedOrders(products);
  return {
    version: DB_VERSION,
    seededAt: new Date().toISOString(),
    categories: seedCategories(),
    brands,
    products,
    orders,
    devices: seedDevices(),
    notifications: seedNotifications(orders, products),
    inventoryLogs: seedInventoryLogs(products, orders),
    auditLogs: seedAuditLogs(),
    discountCodes: seedDiscountCodes(),
    deliveryZones: seedDeliveryZones(),
    policies: seedPolicies(),
    reviews: seedReviews(products),
  };
}

let memoryDb: AdminMockDb | null = null;

function isFresh(db: AdminMockDb): boolean {
  if (db.version !== DB_VERSION) return false;
  const age = Date.now() - new Date(db.seededAt).getTime();
  return Number.isFinite(age) && age < RESEED_AFTER_DAYS * DAY_MS;
}

export function loadAdminDb(): AdminMockDb {
  if (memoryDb) return memoryDb;
  const stored = safeGetJson<AdminMockDb | null>(ADMIN_DB_STORAGE_KEY, null);
  memoryDb = stored && isFresh(stored) ? stored : createSeedDb();
  if (memoryDb !== stored) safeSetJson(ADMIN_DB_STORAGE_KEY, memoryDb);
  return memoryDb;
}

export function saveAdminDb(db: AdminMockDb): void {
  memoryDb = db;
  safeSetJson(ADMIN_DB_STORAGE_KEY, db);
}

export function resetAdminDb(): AdminMockDb {
  memoryDb = null;
  safeStorage.removeItem(ADMIN_DB_STORAGE_KEY);
  return loadAdminDb();
}
