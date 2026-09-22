import type { PolicyKey, ProductListQuery, ReviewsQuery } from "@/types/api.types";

export const STALE_TIMES = {
  categories: 10 * 60_000,
  brands: 10 * 60_000,
  deliveryZones: 10 * 60_000,
  policies: 10 * 60_000,
  products: 60_000,
  productDetails: 2 * 60_000,
  search: 30_000,
  reviews: 5 * 60_000,
  admin: 0,
} as const;

/** Strips undefined values so identical queries share one cache entry. */
function stable<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ""),
  ) as T;
}

export const queryKeys = {
  categories: ["categories"] as const,
  brands: ["brands"] as const,
  deliveryZones: ["delivery-zones"] as const,
  policies: ["policies"] as const,
  policy: (key: PolicyKey) => ["policies", key] as const,
  products: (query: ProductListQuery) => ["products", "list", stable(query)] as const,
  product: (id: string) => ["products", "detail", id] as const,
  search: (term: string) => ["search", term] as const,
  reviews: (query: ReviewsQuery) => ["reviews", stable(query)] as const,
  admin: {
    products: (query: ProductListQuery) => ["admin", "products", query] as const,
    orders: ["admin", "orders"] as const,
    inventory: (productId: string) => ["admin", "inventory", productId] as const,
    devices: ["admin", "devices"] as const,
    notifications: ["admin", "notifications"] as const,
  },
} as const;
