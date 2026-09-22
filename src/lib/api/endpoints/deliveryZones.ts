import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type { ApiSuccess, DeliveryZone } from "@/types/api.types";

/** `GET /delivery-zones` — active zones only. */
export async function getDeliveryZones(signal?: AbortSignal): Promise<DeliveryZone[]> {
  if (isMockApi) return publicHandlers.getDeliveryZones();
  const response = await apiClient.get<ApiSuccess<DeliveryZone[]>>("/delivery-zones", { signal });
  return response.data.data;
}
