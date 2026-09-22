"use client";

import { useQuery } from "@tanstack/react-query";
import { getDeliveryZones } from "@/lib/api/endpoints/deliveryZones";
import { queryKeys, STALE_TIMES } from "@/lib/constants/query";

/** Active delivery zones (`GET /delivery-zones`). */
export function useDeliveryZones(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.deliveryZones,
    queryFn: ({ signal }) => getDeliveryZones(signal),
    staleTime: STALE_TIMES.deliveryZones,
    enabled: options.enabled ?? true,
  });
}
