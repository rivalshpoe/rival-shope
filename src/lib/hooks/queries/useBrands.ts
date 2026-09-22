"use client";

import { useQuery } from "@tanstack/react-query";
import { getBrands } from "@/lib/api/endpoints/brands";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";

export const brandsQueryOptions = {
  queryKey: queryKeys.brands,
  queryFn: ({ signal }: { signal: AbortSignal }) => getBrands(signal),
  staleTime: STALE_TIMES.brands,
};

/** All brands (`GET /brands`). */
export function useBrands() {
  return useQuery(brandsQueryOptions);
}
