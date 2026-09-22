"use client";

import { useMemo } from "react";
import { infiniteQueryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getProducts, PRODUCTS_PAGE_SIZE } from "@/lib/api/endpoints/products";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";
import type { ApiListData, ProductListItem, ProductListQuery } from "@/types/api.types";

type ListFilters = Omit<ProductListQuery, "page">;

export function productsInfiniteOptions(filters: ListFilters = {}) {
  const pageSize = filters.pageSize ?? PRODUCTS_PAGE_SIZE;
  return infiniteQueryOptions({
    queryKey: queryKeys.products({ ...filters, pageSize }),
    queryFn: ({ pageParam, signal }) => getProducts({ ...filters, pageSize, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage: ApiListData<ProductListItem>) =>
      lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    staleTime: STALE_TIMES.products,
  });
}

/**
 * Infinite product list (10 per page) for "load more" UIs.
 * Exposes flattened `items`, `totalItems` and a 0–100 `progress` for the progress bar.
 */
export function useProducts(filters: ListFilters = {}, options: { enabled?: boolean } = {}) {
  const query = useInfiniteQuery({ ...productsInfiniteOptions(filters), enabled: options.enabled ?? true });
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const totalItems = query.data?.pages.at(-1)?.pagination.totalItems ?? 0;
  const progress = totalItems ? Math.min(100, Math.round((items.length / totalItems) * 100)) : 0;
  return { ...query, items, totalItems, progress };
}

/** A single page of products (for rails / related lists that never paginate). */
export function useProductPage(query: ProductListQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.products({ page: 1, ...query }),
    queryFn: ({ signal }) => getProducts({ page: 1, ...query }, signal),
    staleTime: STALE_TIMES.products,
    enabled: options.enabled ?? true,
  });
}
