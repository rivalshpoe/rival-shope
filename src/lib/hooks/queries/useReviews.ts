"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getReviews, REVIEWS_PAGE_SIZE } from "@/lib/api/endpoints/reviews";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";
import type { ReviewsQuery } from "@/types/api.types";

/** Approved reviews, optionally scoped to one product. Infinite for "show more". */
export function useReviews(query: Omit<ReviewsQuery, "page"> = {}, options: { enabled?: boolean } = {}) {
  const pageSize = query.pageSize ?? REVIEWS_PAGE_SIZE;
  const result = useInfiniteQuery({
    queryKey: queryKeys.reviews({ ...query, pageSize }),
    queryFn: ({ pageParam, signal }) => getReviews({ ...query, pageSize, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    staleTime: STALE_TIMES.reviews,
    enabled: options.enabled ?? true,
  });
  const items = useMemo(() => result.data?.pages.flatMap((page) => page.items) ?? [], [result.data]);
  const totalItems = result.data?.pages.at(-1)?.pagination.totalItems ?? 0;
  const averageRating = items.length
    ? Math.round((items.reduce((sum, review) => sum + review.rating, 0) / items.length) * 10) / 10
    : 0;
  return { ...result, items, totalItems, averageRating };
}
