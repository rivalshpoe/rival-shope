"use client";

import { useQuery } from "@tanstack/react-query";
import { getPolicies, getPolicy } from "@/lib/api/endpoints/policies";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";
import type { Policy, PolicyKey } from "@/types/api.types";

/** `GET /policies` */
export function usePolicies() {
  return useQuery({
    queryKey: queryKeys.policies,
    queryFn: ({ signal }) => getPolicies(signal),
    staleTime: STALE_TIMES.policies,
  });
}

/** `GET /policies/{key}`; pass `initialData` when the server already fetched it. */
export function usePolicy(key: PolicyKey, options: { initialData?: Policy } = {}) {
  return useQuery({
    queryKey: queryKeys.policy(key),
    queryFn: ({ signal }) => getPolicy(key, signal),
    staleTime: STALE_TIMES.policies,
    initialData: options.initialData,
  });
}
