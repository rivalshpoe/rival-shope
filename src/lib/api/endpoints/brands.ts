import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type { ApiSuccess, Brand } from "@/types/api.types";

/** `GET /brands` */
export async function getBrands(signal?: AbortSignal): Promise<Brand[]> {
  if (isMockApi) return publicHandlers.getBrands();
  const response = await apiClient.get<ApiSuccess<Brand[]>>("/brands", { signal });
  return response.data.data;
}
