import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type { ApiListData, ApiListResponse, ProductListItem, SearchQuery } from "@/types/api.types";

export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_PAGE_SIZE = 10;

export function sanitizeSearchTerm(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
}

/** `GET /search?q=&page=&pageSize=` — `q` must be ≤ 100 characters. */
export async function searchProducts(
  query: SearchQuery,
  signal?: AbortSignal,
): Promise<ApiListData<ProductListItem>> {
  const normalized: SearchQuery = {
    q: sanitizeSearchTerm(query.q),
    page: query.page ?? 1,
    pageSize: query.pageSize ?? SEARCH_PAGE_SIZE,
  };
  if (isMockApi) return publicHandlers.search(normalized);
  const response = await apiClient.get<ApiListResponse<ProductListItem>>("/search", {
    params: normalized,
    signal,
  });
  return response.data.data;
}
