import type {
  AdminAnalyticsQuery,
  AdminDevicesQuery,
  AdminInventoryHistoryQuery,
  AdminInventoryQuery,
  AdminNotificationsQuery,
  AdminOrdersQuery,
  AdminPageQuery,
  AdminProductsQuery,
  AdminReviewsQuery,
} from "@/types/admin.types";

/** Query keys for every admin resource. Prefixes allow broad invalidation. */
export const adminKeys = {
  all: ["admin"] as const,
  me: ["admin", "me"] as const,
  categories: ["admin", "categories"] as const,
  brands: ["admin", "brands"] as const,
  products: {
    all: ["admin", "products"] as const,
    list: (query: AdminProductsQuery) => ["admin", "products", "list", query] as const,
    detail: (id: string) => ["admin", "products", "detail", id] as const,
  },
  orders: {
    all: ["admin", "orders"] as const,
    list: (query: AdminOrdersQuery) => ["admin", "orders", "list", query] as const,
    detail: (id: string) => ["admin", "orders", "detail", id] as const,
    collected: (query: AdminPageQuery) => ["admin", "orders", "collected", query] as const,
  },
  deliveryZones: ["admin", "delivery-zones"] as const,
  discountCodes: ["admin", "discount-codes"] as const,
  inventory: {
    all: ["admin", "inventory"] as const,
    list: (query: AdminInventoryQuery) => ["admin", "inventory", "list", query] as const,
    history: (productId: string, query: AdminInventoryHistoryQuery) =>
      ["admin", "inventory", "history", productId, query] as const,
  },
  devices: {
    all: ["admin", "devices"] as const,
    list: (query: AdminDevicesQuery) => ["admin", "devices", "list", query] as const,
  },
  notifications: {
    all: ["admin", "notifications"] as const,
    list: (query: AdminNotificationsQuery) => ["admin", "notifications", "list", query] as const,
  },
  analytics: (query: AdminAnalyticsQuery) => ["admin", "analytics", query] as const,
  analyticsAll: ["admin", "analytics"] as const,
  policies: ["admin", "policies"] as const,
  reviews: {
    all: ["admin", "reviews"] as const,
    list: (query: AdminReviewsQuery) => ["admin", "reviews", "list", query] as const,
  },
  auditLogs: (query: AdminPageQuery) => ["admin", "audit-logs", query] as const,
  auditLogsAll: ["admin", "audit-logs"] as const,
};
