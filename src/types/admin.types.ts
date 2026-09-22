/**
 * Admin DTOs — mirrors `docs/api-contract-addendum.md` exactly.
 * Every list endpoint returns `ApiListData<T>` (`{ items, pagination }`).
 */

// ---------- Auth ----------
export interface AdminRequestOtpRequest {
  email: string;
}

export interface AdminRequestOtpResponse {
  success: boolean;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export interface AdminVerifyOtpRequest {
  email: string;
  code: string;
}

export interface AdminVerifyOtpResponse {
  success: true;
  accessToken: string;
  expiresIn: number;
}

export interface AdminRefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface AdminMeResponse {
  email: string;
}

// ---------- Catalog ----------
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface AdminCategoryInput {
  name: string;
  slug?: string;
  imageUrl: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
}

export interface AdminBrandInput {
  name: string;
  slug?: string;
  imageUrl: string;
}

export interface AdminProductRow {
  id: string;
  title: string;
  slug: string;
  primaryImageUrl: string;
  categoryId: string;
  categoryName: string;
  brandName: string | null;
  price: number;
  discountPrice: number | null;
  isDiscountActive: boolean;
  hasSizes: boolean;
  totalStock: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminProductSize {
  id: string;
  label: string;
  price: number;
  stock: number;
}

export interface AdminProductColor {
  id: string;
  name: string;
  hex: string;
}

export interface AdminProductImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface AdminProductBrandRef {
  id: string;
  name: string;
  slug: string;
}

/** `ProductDetails` + admin-only fields (see contract). */
export interface AdminProductDetails {
  id: string;
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  brandId: string | null;
  brand: AdminProductBrandRef | null;
  price: number;
  discountPrice: number | null;
  discountStartAt: string | null;
  discountEndAt: string | null;
  isDiscountActive: boolean;
  hasSizes: boolean;
  stock: number;
  sizes: AdminProductSize[];
  colors: AdminProductColor[];
  images: AdminProductImage[];
  isActive: boolean;
  relatedProductIds: string[];
  createdAt: string;
}

export interface AdminProductSizeInput {
  id?: string;
  label: string;
  price: number;
  stock: number;
}

export interface AdminProductColorInput {
  id?: string;
  name: string;
  hex: string;
}

export interface AdminProductInput {
  title: string;
  description: string;
  categoryId: string;
  brandId: string | null;
  price: number;
  discountPrice: number | null;
  discountStartAt: string | null;
  discountEndAt: string | null;
  hasSizes: boolean;
  stock: number;
  sizes: AdminProductSizeInput[];
  colors: AdminProductColorInput[];
  /** First url is the primary image. */
  imageUrls: string[];
  isActive: boolean;
}

export interface AdminProductsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface AdminUploadResponse {
  url: string;
  thumbnailUrl: string;
}

// ---------- Orders ----------
export type AdminOrderStatus = "Pending" | "Confirmed" | "Cancelled" | "Fake";
export type AdminOrderStatusUpdate = Exclude<AdminOrderStatus, "Pending">;

export interface AdminOrderRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  phoneNumber: string;
  whatsAppCountryCode: "970" | "972";
  total: number;
  status: AdminOrderStatus;
  itemCount: number;
  isCollected: boolean;
  createdAt: string;
}

export interface AdminOrderItem {
  productId: string;
  productTitle: string;
  productImageUrl: string;
  sizeLabel: string | null;
  colorName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminOrderDevice {
  id: string;
  isBlocked: boolean;
  fakeOrderCount: number;
}

export interface AdminOrderDetails {
  id: string;
  invoiceNumber: string;
  status: AdminOrderStatus;
  customerName: string;
  phoneNumber: string;
  whatsAppCountryCode: "970" | "972";
  /** e.g. "970599123456" */
  whatsAppNumber: string;
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
  editableUntil: string;
  canEdit: boolean;
  device: AdminOrderDevice;
  items: AdminOrderItem[];
}

export interface AdminOrdersQuery {
  status?: AdminOrderStatus;
  search?: string;
  from?: string;
  to?: string;
  isCollected?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminUpdateOrderStatusRequest {
  status: AdminOrderStatusUpdate;
}

export interface AdminCollectOrdersRequest {
  invoiceNumbers: string[];
}

export interface AdminCollectOrdersResponse {
  collectedCount: number;
  collectedAmount: number;
  notFound: string[];
}

// ---------- Delivery & discounts ----------
export interface AdminDeliveryZone {
  id: string;
  name: string;
  extraFee: number | null;
  isActive: boolean;
}

export interface AdminDeliveryZoneInput {
  name: string;
  extraFee: number | null;
  isActive: boolean;
}

export interface AdminDiscountCode {
  id: string;
  code: string;
  percentageOff: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
  usageCount: number;
  isCurrentlyValid: boolean;
}

export interface AdminDiscountCodeInput {
  code: string;
  percentageOff: number;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

// ---------- Inventory ----------
export interface AdminInventoryRow {
  productId: string;
  productTitle: string;
  primaryImageUrl: string;
  sizeId: string | null;
  sizeLabel: string | null;
  stock: number;
  isLow: boolean;
  isDepleted: boolean;
  lastChangeAt: string;
}

export interface AdminInventoryQuery {
  lowStockOnly?: boolean;
  threshold?: number;
  page?: number;
  pageSize?: number;
}

export interface AdminRestockRequest {
  productId: string;
  sizeId: string | null;
  quantity: number;
  note: string | null;
}

export interface AdminRestockResponse {
  productId: string;
  sizeId: string | null;
  stock: number;
}

export type InventoryChangeType = "Sale" | "Restock" | "Depleted" | "Return";

export interface InventoryLog {
  id: string;
  changeType: InventoryChangeType;
  quantityChanged: number;
  stockAfter: number;
  note: string | null;
  createdAt: string;
}

export interface AdminInventoryHistoryQuery {
  sizeId?: string;
  page?: number;
  pageSize?: number;
}

// ---------- Devices / notifications / analytics ----------
export interface AdminDevice {
  id: string;
  maskedHash: string;
  fakeOrderCount: number;
  totalOrders: number;
  isBlocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  lastOrderAt: string | null;
}

export interface AdminDevicesQuery {
  blockedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminBlockDeviceRequest {
  isBlocked: boolean;
  reason: string | null;
}

export type AdminNotificationType = "NewOrder" | "LowStock" | "Depleted";

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  relatedOrderId: string | null;
  relatedProductId: string | null;
  isResolved: boolean;
  createdAt: string;
}

export interface AdminNotificationsQuery {
  unresolvedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AdminSalesByDay {
  date: string;
  total: number;
  count: number;
}

export interface AdminTopProduct {
  productId: string;
  title: string;
  quantity: number;
  revenue: number;
}

export interface AdminAnalyticsSummary {
  ordersCount: number;
  pendingCount: number;
  confirmedCount: number;
  cancelledCount: number;
  fakeCount: number;
  totalSold: number;
  totalCollected: number;
  totalUncollected: number;
  productsCount: number;
  lowStockCount: number;
  depletedCount: number;
  todayOrders: number;
  todaySales: number;
  salesByDay: AdminSalesByDay[];
  topProducts: AdminTopProduct[];
}

export interface AdminAnalyticsQuery {
  from?: string;
  to?: string;
}

// ---------- Content ----------
export type PolicyKey = "order" | "cancellation" | "returns" | "shipping" | "privacy";

export interface AdminPolicy {
  key: PolicyKey;
  title: string;
  content: string;
  updatedAt: string;
}

export interface AdminPolicyInput {
  title: string;
  content: string;
}

export interface AdminReview {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  productId: string | null;
  productTitle: string | null;
  createdAt: string;
  isApproved: boolean;
}

export interface AdminReviewInput {
  customerName: string;
  rating: number;
  comment: string;
  imageUrl: string | null;
  productId: string | null;
  isApproved: boolean;
}

export interface AdminReviewsQuery {
  page?: number;
  pageSize?: number;
  approvedOnly?: boolean;
}

export interface AdminAuditLog {
  id: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  createdAt: string;
}

export interface AdminPageQuery {
  page?: number;
  pageSize?: number;
}
