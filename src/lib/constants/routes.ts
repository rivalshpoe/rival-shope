import type { PolicyKey } from "@/types/api.types";

export const POLICY_ROUTES: Record<PolicyKey, string> = {
  order: "/order-policy",
  cancellation: "/cancellation-policy",
  returns: "/returns-policy",
  shipping: "/shipping-policy",
  privacy: "/privacy-policy",
};

export const ROUTES = {
  home: "/",
  products: "/products",
  search: "/search",
  cart: "/cart",
  checkout: "/checkout",
  wishlist: "/wishlist",
  compare: "/compare",
  adminLogin: "/mgmt-portal-x7k9",
  adminDashboard: "/mgmt-portal-x7k9/dashboard",
  category: (slug: string) => `/category/${encodeURIComponent(slug)}`,
  subCategory: (slug: string, subSlug: string) =>
    `/category/${encodeURIComponent(slug)}/${encodeURIComponent(subSlug)}`,
  brand: (slug: string) => `/products?brand=${encodeURIComponent(slug)}`,
  product: (id: string) => `/product/${encodeURIComponent(id)}`,
  policy: (key: PolicyKey) => POLICY_ROUTES[key],
  orderSuccess: (invoiceNumber: string) =>
    `/order-success/${encodeURIComponent(invoiceNumber)}`,
} as const;

export const WHATSAPP_SUPPORT_URL = "https://wa.me/970599000000";
