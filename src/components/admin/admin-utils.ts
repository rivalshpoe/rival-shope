import { AppError } from "@/lib/api/errors";
import type { AdminOrderDetails, AdminOrderStatus, InventoryChangeType, PolicyKey } from "@/types/admin.types";

export const ADMIN_BASE = "/mgmt-portal-x7k9/dashboard";
export const ADMIN_LOGIN = "/mgmt-portal-x7k9";

export const adminRoutes = {
  home: ADMIN_BASE,
  categories: `${ADMIN_BASE}/categories`,
  brands: `${ADMIN_BASE}/brands`,
  products: `${ADMIN_BASE}/products`,
  productNew: `${ADMIN_BASE}/products/new`,
  productEdit: (id: string) => `${ADMIN_BASE}/products/${encodeURIComponent(id)}/edit`,
  orders: `${ADMIN_BASE}/orders`,
  order: (id: string) => `${ADMIN_BASE}/orders/${encodeURIComponent(id)}`,
  collections: `${ADMIN_BASE}/collections`,
  deliveryZones: `${ADMIN_BASE}/delivery-zones`,
  discountCodes: `${ADMIN_BASE}/discount-codes`,
  inventory: `${ADMIN_BASE}/inventory`,
  inventoryHistory: (productId: string, sizeId?: string | null) =>
    `${ADMIN_BASE}/inventory/${encodeURIComponent(productId)}/history${sizeId ? `?sizeId=${encodeURIComponent(sizeId)}` : ""}`,
  devices: `${ADMIN_BASE}/devices`,
  notifications: `${ADMIN_BASE}/notifications`,
  policies: `${ADMIN_BASE}/policies`,
  reviews: `${ADMIN_BASE}/reviews`,
  reviewNew: `${ADMIN_BASE}/reviews/new`,
  reviewEdit: (id: string) => `${ADMIN_BASE}/reviews/${encodeURIComponent(id)}/edit`,
  auditLogs: `${ADMIN_BASE}/audit-logs`,
  storefrontProduct: (id: string) => `/product/${encodeURIComponent(id)}`,
} as const;

export type Tone = "green" | "amber" | "red" | "slate" | "blue" | "gold";

// ---------- formatting ----------
const money = new Intl.NumberFormat("ar-PS", { style: "currency", currency: "ILS", maximumFractionDigits: 0 });
const moneyPrecise = new Intl.NumberFormat("ar-PS", { style: "currency", currency: "ILS", minimumFractionDigits: 2 });
const integer = new Intl.NumberFormat("ar-EG");
const dateTime = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });
const weekday = new Intl.DateTimeFormat("ar", { weekday: "short" });
const relative = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

export const formatMoney = (value: number): string => money.format(value);
export const formatMoneyPrecise = (value: number): string => moneyPrecise.format(value);
export const formatNumber = (value: number): string => integer.format(value);

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateOnly.format(date);
}

export function formatWeekday(iso: string): string {
  return weekday.format(new Date(`${iso}T12:00:00`));
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative.format(days, "day");
  return formatDate(iso);
}

/** ISO → value for `<input type="datetime-local">` (local time). */
export function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `<input type="datetime-local">` value → UTC ISO string (or null). */
export function fromDatetimeLocal(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- labels ----------
export const ORDER_STATUS_LABEL: Record<AdminOrderStatus, string> = {
  Pending: "قيد الانتظار",
  Confirmed: "مؤكد",
  Cancelled: "ملغي",
  Fake: "وهمي",
};

export const ORDER_STATUS_TONE: Record<AdminOrderStatus, Tone> = {
  Pending: "amber",
  Confirmed: "green",
  Cancelled: "slate",
  Fake: "red",
};

export const INVENTORY_CHANGE_LABEL: Record<InventoryChangeType, string> = {
  Sale: "بيع",
  Restock: "إعادة تعبئة",
  Depleted: "نفد المخزون",
  Return: "إرجاع",
};

export const INVENTORY_CHANGE_TONE: Record<InventoryChangeType, Tone> = {
  Sale: "blue",
  Restock: "green",
  Depleted: "red",
  Return: "amber",
};

export const POLICY_LABEL: Record<PolicyKey, string> = {
  order: "سياسة الطلب",
  cancellation: "سياسة الإلغاء",
  returns: "سياسة الإرجاع",
  shipping: "سياسة الشحن والتوصيل",
  privacy: "سياسة الخصوصية",
};

export const POLICY_KEYS: PolicyKey[] = ["order", "cancellation", "returns", "shipping", "privacy"];

export const NOTIFICATION_TYPE_LABEL = {
  NewOrder: "طلب جديد",
  LowStock: "مخزون منخفض",
  Depleted: "نفد المخزون",
} as const;

// ---------- WhatsApp ----------
export function buildWhatsAppLink(order: AdminOrderDetails): string {
  const lines = [
    `مرحبًا ${order.customerName}، معك متجر Rival 🌸`,
    `بخصوص طلبك رقم ${order.invoiceNumber}:`,
    ...order.items.map((item) => {
      const variant = [item.sizeLabel && `مقاس ${item.sizeLabel}`, item.colorName && `لون ${item.colorName}`].filter(Boolean).join("، ");
      return `• ${item.productTitle}${variant ? ` (${variant})` : ""} × ${item.quantity} — ${formatMoney(item.lineTotal)}`;
    }),
    order.deliveryFee ? `التوصيل: ${formatMoney(order.deliveryFee)}` : null,
    order.discountAmount ? `الخصم: -${formatMoney(order.discountAmount)}` : null,
    `الإجمالي: ${formatMoney(order.total)}`,
    "يرجى تأكيد الطلب للمتابعة. شكرًا لثقتك بنا 🤍",
  ].filter((line): line is string => Boolean(line));
  return `https://wa.me/${order.whatsAppNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
}

// ---------- errors ----------
const GENERIC_ERROR = "حدث خطأ غير متوقع. حاول مجددًا.";

/** Always returns a friendly Arabic message — never technical details. */
export function friendlyError(error: unknown, fallback = GENERIC_ERROR): string {
  if (error instanceof AppError) return error.message || fallback;
  return fallback;
}

export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof AppError && error.fieldErrors ? error.fieldErrors : {};
}

export function isLockedError(error: unknown): boolean {
  return error instanceof AppError && error.code === "INVOICE_LOCKED";
}

export function maskHash(hash: string): string {
  if (hash.includes("…")) return hash;
  return hash.length <= 8 ? hash : `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
