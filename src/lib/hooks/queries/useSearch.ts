"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { sanitizeSearchTerm, SEARCH_PAGE_SIZE, searchProducts } from "@/lib/api/endpoints/search";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";

/**
 * Infinite search (`GET /search`). Disabled until `term` is non-empty.
 * Pass an already-debounced term.
 */
export function useSearch(term: string) {
  const q = sanitizeSearchTerm(term);
  const query = useInfiniteQuery({
    queryKey: queryKeys.search(q),
    queryFn: ({ pageParam, signal }) => searchProducts({ q, page: pageParam, pageSize: SEARCH_PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    enabled: q.length > 0,
    staleTime: STALE_TIMES.search,
    placeholderData: (previous) => previous,
  });
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const totalItems = query.data?.pages.at(-1)?.pagination.totalItems ?? 0;
  return { ...query, items, totalItems, term: q };
}
