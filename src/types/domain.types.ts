import type { ProductListItem } from "./api.types";

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
}

export interface Review {
  id: string;
  productId: string;
  customerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string;
  isApproved: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  fee: number;
  isActive: boolean;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: "fixed" | "percentage";
  value: number;
  isActive: boolean;
  expiresAt: string | null;
}

export interface CartItem {
  product: ProductListItem;
  sizeId: string | null;
  colorId: string | null;
  quantity: number;
  /** Human-readable size label captured at add time (sizes may carry their own price). */
  sizeLabel?: string | null;
  /** Human-readable colour name captured at add time. */
  colorName?: string | null;
  /** Unit price actually charged (size price or discounted price). Falls back to product pricing when absent. */
  unitPrice?: number;
}

export type AdminOrderStatus =
  | "Pending"
  | "Confirmed"
  | "Preparing"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export interface AdminOrderRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  phoneNumber: string;
  total: number;
  status: AdminOrderStatus;
  itemCount: number;
  createdAt: string;
}

export interface InventoryRecord {
  id: string;
  productId: string;
  change: number;
  stockAfter: number;
  reason: "sale" | "restock" | "adjustment" | "return";
  createdAt: string;
}

export interface AdminDevice {
  id: string;
  fingerprint: string;
  orderCountLastHour: number;
  isBlocked: boolean;
  lastSeenAt: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  orderId: string | null;
  isResolved: boolean;
  createdAt: string;
}

export interface AdminProductInput {
  title: string;
  description: string;
  categoryId: string;
  price: number;
  discountPrice: number | null;
  stock: number;
}
