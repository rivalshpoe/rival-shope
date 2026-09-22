export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiListData<T> {
  items: T[];
  pagination: Pagination;
}

export interface ApiErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  correlationId: string;
  fieldErrors?: Record<string, string>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;
export type ApiListResponse<T> = ApiSuccess<ApiListData<T>>;

export type ProductSort = "newest" | "bestselling" | "priceAsc" | "priceDesc";

/** `GET /categories` item. `parentId === null` marks a main category. */
export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

/** `GET /brands` item. */
export interface Brand {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
}

export interface ProductListQuery {
  categoryId?: string;
  subCategoryId?: string;
  categorySlug?: string;
  brandId?: string;
  brandSlug?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: ProductSort;
}

export interface SearchQuery {
  q: string;
  page?: number;
  pageSize?: number;
}

export interface ProductListItem {
  id: string;
  title: string;
  slug: string;
  primaryImageUrl: string;
  price: number;
  discountPrice: number | null;
  isDiscountActive: boolean;
  hasSizes: boolean;
  hasColors: boolean;
  categoryId: string;
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
}

export interface ProductImage {
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

export interface ProductSize {
  id: string;
  label: string;
  price: number;
  inStock: boolean;
}

export interface ProductBrandRef {
  id: string;
  name: string;
  slug: string;
}

export interface ProductDetails {
  id: string;
  title: string;
  slug: string;
  description: string;
  images: ProductImage[];
  colors: ProductColor[];
  sizes: ProductSize[];
  price: number;
  discountPrice: number | null;
  isDiscountActive: boolean;
  stock: number;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  brand: ProductBrandRef | null;
  relatedProductIds: string[];
}

export type PolicyKey = "order" | "cancellation" | "returns" | "shipping" | "privacy";

/** `GET /policies` item. `content` is plain text; blank lines separate paragraphs and `## ` prefixes headings. */
export interface Policy {
  key: PolicyKey;
  title: string;
  content: string;
  updatedAt: string;
}

/** `GET /reviews` item (approved reviews only). */
export interface Review {
  id: string;
  customerName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  imageUrl: string | null;
  productId: string | null;
  productTitle: string | null;
  createdAt: string;
}

export interface ReviewsQuery {
  productId?: string;
  page?: number;
  pageSize?: number;
}

/** `GET /delivery-zones` item (active zones only). */
export interface DeliveryZone {
  id: string;
  name: string;
  extraFee: number | null;
  isActive: boolean;
}

export type HealthStatus = "Healthy" | "Degraded" | "Unhealthy";

export interface HealthResponse {
  status: HealthStatus;
  checks: {
    postgres: HealthStatus;
    redis: HealthStatus;
  };
}

export interface CreateOrderItem {
  productId: string;
  sizeId: string | null;
  colorId: string | null;
  quantity: number;
}

export interface CreateOrderRequest {
  items: CreateOrderItem[];
  needsDelivery: boolean;
  deliveryZoneId: string | null;
  address: string | null;
  customerName: string;
  phoneNumber: string;
  whatsAppCountryCode: "970" | "972";
  discountCode: string | null;
}

export interface CreateOrderResponse {
  invoiceNumber: string;
  total: number;
  discountAmount: number;
  status: "Pending";
}

export interface ValidateDiscountCodeRequest {
  code: string;
  subtotal: number;
}

export type ValidateDiscountCodeResponse =
  | { isValid: true; discountAmount: number }
  | { isValid: false };

export interface RequestOtpRequest {
  email: string;
}

export interface RequestOtpResponse {
  success: boolean;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
}

export type VerifyOtpResponse =
  | { success: true; accessToken?: string; expiresIn?: number }
  | { success: false };
