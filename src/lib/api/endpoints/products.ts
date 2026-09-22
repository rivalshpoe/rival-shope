import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type {
  ApiListData,
  ApiListResponse,
  ApiSuccess,
  ProductDetails,
  ProductListItem,
  ProductListQuery,
} from "@/types/api.types";

export const PRODUCTS_PAGE_SIZE = 10;

/** `GET /products` — paginated list with optional category / brand / search filters. */
export async function getProducts(
  query: ProductListQuery = {},
  signal?: AbortSignal,
): Promise<ApiListData<ProductListItem>> {
  const normalized: ProductListQuery = { pageSize: PRODUCTS_PAGE_SIZE, ...query };
  if (isMockApi) return publicHandlers.getProducts(normalized);
  const response = await apiClient.get<ApiListResponse<ProductListItem>>("/products", {
    params: normalized,
    signal,
  });
  return response.data.data;
}

/** `GET /products/{id}` */
export async function getProduct(id: string, signal?: AbortSignal): Promise<ProductDetails> {
  if (isMockApi) return publicHandlers.getProduct(id);
  const response = await apiClient.get<ApiSuccess<ProductDetails>>(
    `/products/${encodeURIComponent(id)}`,
    { signal },
  );
  return response.data.data;
}

/** Effective unit price of a list item (discount applied when active). */
export function getEffectivePrice(product: Pick<ProductListItem, "price" | "discountPrice" | "isDiscountActive">): number {
  return product.isDiscountActive && product.discountPrice !== null ? product.discountPrice : product.price;
}

/** Collapses a `ProductDetails` payload into the list-item shape used by cart / cards. */
export function toListItem(product: ProductDetails): ProductListItem {
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    primaryImageUrl: primary?.url ?? "",
    price: product.price,
    discountPrice: product.discountPrice,
    isDiscountActive: product.isDiscountActive,
    hasSizes: product.sizes.length > 0,
    hasColors: product.colors.length > 0,
    categoryId: product.categoryId,
    brandId: product.brand?.id ?? null,
    brandName: product.brand?.name ?? null,
    brandSlug: product.brand?.slug ?? null,
  };
}
