import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type { ApiListData, ApiListResponse, Review, ReviewsQuery } from "@/types/api.types";

export const REVIEWS_PAGE_SIZE = 6;

/** `GET /reviews?productId?&page&pageSize` — approved reviews only. */
export async function getReviews(
  query: ReviewsQuery = {},
  signal?: AbortSignal,
): Promise<ApiListData<Review>> {
  const normalized: ReviewsQuery = { page: 1, pageSize: REVIEWS_PAGE_SIZE, ...query };
  if (isMockApi) return publicHandlers.getReviews(normalized);
  const response = await apiClient.get<ApiListResponse<Review>>("/reviews", {
    params: normalized,
    signal,
  });
  return response.data.data;
}
