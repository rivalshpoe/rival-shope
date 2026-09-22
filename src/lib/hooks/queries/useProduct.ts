"use client";

import { useMemo } from "react";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { getProduct, toListItem } from "@/lib/api/endpoints/products";
import { isNotFoundError } from "@/lib/api/errors";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";
import type { ProductDetails, ProductListItem } from "@/types/api.types";

export function productQueryOptions(id: string) {
  return queryOptions({
    queryKey: queryKeys.product(id),
    queryFn: ({ signal }) => getProduct(id, signal),
    staleTime: STALE_TIMES.productDetails,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  });
}

/** `GET /products/{id}`; pass `initialData` when the server already fetched the product. */
export function useProduct(id: string, options: { initialData?: ProductDetails; enabled?: boolean } = {}) {
  return useQuery({
    ...productQueryOptions(id),
    initialData: options.initialData,
    enabled: options.enabled ?? Boolean(id),
  });
}

/**
 * Loads several products by id (wishlist / compare) and returns them in the requested order.
 * Products that no longer exist are silently skipped and reported in `missingIds`.
 */
export function useProductsByIds(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => productQueryOptions(id)),
  });

  const isLoading = results.some((result) => result.isPending && !result.isError);
  const products = useMemo(
    () => results.flatMap((result) => (result.data ? [result.data] : [])),
    [results],
  );
  const items: ProductListItem[] = useMemo(() => products.map(toListItem), [products]);
  const missingIds = useMemo(
    () => ids.filter((id, index) => results[index]?.isError && isNotFoundError(results[index]?.error)),
    [ids, results],
  );
  const error = results.find((result) => result.isError && !isNotFoundError(result.error))?.error ?? null;

  return { products, items, isLoading, error, missingIds, refetch: () => results.forEach((result) => void result.refetch()) };
}
