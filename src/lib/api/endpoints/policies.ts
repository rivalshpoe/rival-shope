import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type { ApiSuccess, Policy, PolicyKey } from "@/types/api.types";

export const POLICY_KEYS: readonly PolicyKey[] = ["order", "cancellation", "returns", "shipping", "privacy"];

export function isPolicyKey(value: string): value is PolicyKey {
  return (POLICY_KEYS as readonly string[]).includes(value);
}

/** `GET /policies` */
export async function getPolicies(signal?: AbortSignal): Promise<Policy[]> {
  if (isMockApi) return publicHandlers.getPolicies();
  const response = await apiClient.get<ApiSuccess<Policy[]>>("/policies", { signal });
  return response.data.data;
}

/** `GET /policies/{key}` */
export async function getPolicy(key: PolicyKey, signal?: AbortSignal): Promise<Policy> {
  if (isMockApi) return publicHandlers.getPolicy(key);
  const response = await apiClient.get<ApiSuccess<Policy>>(`/policies/${encodeURIComponent(key)}`, { signal });
  return response.data.data;
}
