import type {
  ApiListData,
  Brand,
  Category,
  CreateOrderRequest,
  CreateOrderResponse,
  DeliveryZone,
  HealthResponse,
  Policy,
  PolicyKey,
  ProductDetails,
  ProductListItem,
  ProductListQuery,
  Review,
  ReviewsQuery,
  SearchQuery,
  ValidateDiscountCodeResponse,
} from "@/types/api.types";
import type { AdminOrderRecord } from "@/types/domain.types";
import { generateUuid } from "@/lib/utils/generateUuid";
import { AppError } from "@/lib/api/errors";
import {
  mockAdminOrders,
  mockBrands,
  mockCategories,
  mockDeliveryZones,
  mockDiscountCodes,
  mockPolicies,
  mockProductDetails,
  mockProducts,
  mockReviews,
} from "./data";
import { adminHandlers } from "./adminHandlers";

/* -------------------------------------------------------------------------- */
/*  Mode & helpers                                                             */
/* -------------------------------------------------------------------------- */

export const isMockApi =
  process.env.NEXT_PUBLIC_USE_MOCK_API === "true" ||
  !process.env.NEXT_PUBLIC_API_BASE_URL;

export async function mockDelay<T>(value: T, milliseconds = 180): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
  return structuredClone(value);
}

export function paginate<T>(items: T[], page = 1, pageSize = 10): ApiListData<T> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const totalItems = items.length;
  return {
    items: items.slice((safePage - 1) * safePageSize, safePage * safePageSize),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / safePageSize),
    },
  };
}

function notFound(message: string): AppError {
  return new AppError("NOT_FOUND", message, null, 404, undefined, "GET");
}

/** Returns the id set of a category plus all of its descendants. */
function categoryTreeIds(rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of mockCategories) {
      if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        grew = true;
      }
    }
  }
  return ids;
}

const productSearchText = (product: ProductListItem) => {
  const details = mockProductDetails.find((candidate) => candidate.id === product.id);
  return `${product.title} ${product.brandName ?? ""} ${details?.categoryName ?? ""} ${details?.description ?? ""}`.toLocaleLowerCase("ar");
};

/* -------------------------------------------------------------------------- */
/*  Product listing                                                            */
/* -------------------------------------------------------------------------- */

export function getMockProducts(query: ProductListQuery): ApiListData<ProductListItem> {
  let items = [...mockProducts];

  const categoryIdFilter =
    query.subCategoryId ??
    query.categoryId ??
    (query.categorySlug
      ? mockCategories.find((category) => category.slug === query.categorySlug)?.id
      : undefined);
  if (categoryIdFilter) {
    const ids = categoryTreeIds(categoryIdFilter);
    items = items.filter((item) => ids.has(item.categoryId));
  } else if (query.categorySlug) {
    items = [];
  }

  if (query.brandId) items = items.filter((item) => item.brandId === query.brandId);
  if (query.brandSlug) items = items.filter((item) => item.brandSlug === query.brandSlug);

  if (query.search) {
    const term = query.search.trim().toLocaleLowerCase("ar");
    if (term) items = items.filter((item) => productSearchText(item).includes(term));
  }

  const effectivePrice = (item: ProductListItem) =>
    item.isDiscountActive && item.discountPrice !== null ? item.discountPrice : item.price;

  switch (query.sort) {
    case "priceAsc":
      items.sort((a, b) => effectivePrice(a) - effectivePrice(b));
      break;
    case "priceDesc":
      items.sort((a, b) => effectivePrice(b) - effectivePrice(a));
      break;
    case "bestselling":
      items.sort((a, b) => Number(b.isDiscountActive) - Number(a.isDiscountActive) || a.id.localeCompare(b.id));
      break;
    case "newest":
    default:
      items.reverse();
  }

  return paginate(items, query.page, query.pageSize ?? 10);
}

/* -------------------------------------------------------------------------- */
/*  Discounts & orders                                                         */
/* -------------------------------------------------------------------------- */

export function validateMockDiscount(code: string, subtotal: number): ValidateDiscountCodeResponse {
  const discount = mockDiscountCodes.find(
    (candidate) => candidate.isActive && candidate.code === code.trim().toUpperCase(),
  );
  if (!discount) return { isValid: false };
  if (discount.expiresAt && new Date(discount.expiresAt).getTime() < Date.now()) return { isValid: false };
  const amount =
    discount.type === "fixed" ? discount.value : Math.round(subtotal * (discount.value / 100));
  return { isValid: true, discountAmount: Math.min(subtotal, amount) };
}

export function createMockOrder(request: CreateOrderRequest): CreateOrderResponse {
  if (!request.items.length) {
    throw new AppError("VALIDATION_ERROR", "لا توجد قطع في الطلب.", null, 422, { items: "الطلب فارغ." }, "POST");
  }

  const subtotal = request.items.reduce((total, item) => {
    const details = mockProductDetails.find((candidate) => candidate.id === item.productId);
    if (!details) throw new AppError("NOT_FOUND", "إحدى القطع لم تعد متاحة.", null, 404, undefined, "POST");
    const size = item.sizeId ? details.sizes.find((candidate) => candidate.id === item.sizeId) : null;
    if (item.sizeId && !size) throw new AppError("VALIDATION_ERROR", "المقاس المختار غير صالح.", null, 422, undefined, "POST");
    if (size && !size.inStock) throw new AppError("OUT_OF_STOCK", "أحد المقاسات لم يعد متوفرًا.", null, 409, undefined, "POST");
    if (!size && details.stock <= 0) throw new AppError("OUT_OF_STOCK", "إحدى القطع نفدت من المخزون.", null, 409, undefined, "POST");
    const unit = size
      ? size.price
      : details.isDiscountActive && details.discountPrice !== null
        ? details.discountPrice
        : details.price;
    return total + unit * item.quantity;
  }, 0);

  const discount = request.discountCode
    ? validateMockDiscount(request.discountCode, subtotal)
    : ({ isValid: false } as const);
  const discountAmount = discount.isValid ? discount.discountAmount : 0;
  const zone = request.needsDelivery && request.deliveryZoneId
    ? mockDeliveryZones.find((candidate) => candidate.id === request.deliveryZoneId)
    : undefined;
  const deliveryFee = zone?.extraFee ?? 0;
  const total = Math.max(0, subtotal - discountAmount + deliveryFee);

  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const invoiceNumber = `RIV-${stamp}-${String(mockAdminOrders.length + 1).padStart(3, "0")}`;

  const record: AdminOrderRecord = {
    id: generateUuid(),
    invoiceNumber,
    customerName: request.customerName,
    phoneNumber: request.phoneNumber,
    total,
    status: "Pending",
    itemCount: request.items.reduce((count, item) => count + item.quantity, 0),
    createdAt: now.toISOString(),
  };
  mockAdminOrders.unshift(record);

  return { invoiceNumber, total, discountAmount, status: "Pending" };
}

/* -------------------------------------------------------------------------- */
/*  Public handlers (mirror of the public API surface)                         */
/* -------------------------------------------------------------------------- */

export const publicHandlers = {
  getCategories: (): Promise<Category[]> =>
    mockDelay(
      mockCategories
        .filter((category) => category.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    ),

  getBrands: (): Promise<Brand[]> => mockDelay(mockBrands),

  getProducts: (query: ProductListQuery = {}): Promise<ApiListData<ProductListItem>> =>
    mockDelay(getMockProducts(query), 260),

  getProduct: async (idOrSlug: string): Promise<ProductDetails> => {
    const product = mockProductDetails.find(
      (candidate) => candidate.id === idOrSlug || candidate.slug === idOrSlug,
    );
    if (!product) throw notFound("لم نجد هذه القطعة.");
    return mockDelay(product, 220);
  },

  search: async (query: SearchQuery): Promise<ApiListData<ProductListItem>> => {
    const term = query.q.trim();
    if (term.length > 100) {
      throw new AppError("SEARCH_TOO_LONG", "كلمة البحث طويلة جدًا.", null, 400, undefined, "GET");
    }
    if (!term) return mockDelay(paginate([], 1, query.pageSize ?? 10));
    return mockDelay(getMockProducts({ search: term, page: query.page, pageSize: query.pageSize ?? 10 }), 240);
  },

  getDeliveryZones: (): Promise<DeliveryZone[]> =>
    mockDelay(mockDeliveryZones.filter((zone) => zone.isActive)),

  validateDiscountCode: (code: string, subtotal: number): Promise<ValidateDiscountCodeResponse> =>
    mockDelay(validateMockDiscount(code, subtotal), 300),

  createOrder: (request: CreateOrderRequest): Promise<CreateOrderResponse> =>
    mockDelay(createMockOrder(request), 700),

  getPolicies: (): Promise<Policy[]> => mockDelay(mockPolicies),

  getPolicy: async (key: PolicyKey): Promise<Policy> => {
    const policy = mockPolicies.find((candidate) => candidate.key === key);
    if (!policy) throw notFound("هذه السياسة غير متاحة.");
    return mockDelay(policy);
  },

  getReviews: (query: ReviewsQuery = {}): Promise<ApiListData<Review>> => {
    const items = query.productId
      ? mockReviews.filter((review) => review.productId === query.productId)
      : mockReviews;
    return mockDelay(paginate([...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), query.page, query.pageSize ?? 10));
  },

  getHealth: (): Promise<HealthResponse> =>
    mockDelay({ status: "Healthy", checks: { postgres: "Healthy", redis: "Healthy" } }),
};

export type PublicHandlers = typeof publicHandlers;

/**
 * Every mock handler (public + admin) in one object, for tooling and tests.
 * Resolved lazily because `adminHandlers.ts` imports helpers from this module.
 */
export function getMockHandlers() {
  return { ...publicHandlers, ...adminHandlers };
}

export { adminHandlers };
