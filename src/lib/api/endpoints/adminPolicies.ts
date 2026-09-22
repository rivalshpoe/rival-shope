import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type { AdminPolicy, AdminPolicyInput, PolicyKey } from "@/types/admin.types";

export async function getAdminPolicies(): Promise<AdminPolicy[]> {
  if (isMockApi) return adminHandlers.listPolicies();
  const response = await apiClient.get<ApiSuccess<AdminPolicy[]>>("/admin/policies");
  return response.data.data;
}

export async function updateAdminPolicy(key: PolicyKey, input: AdminPolicyInput): Promise<AdminPolicy> {
  if (isMockApi) return adminHandlers.updatePolicy(key, input);
  const response = await apiClient.put<ApiSuccess<AdminPolicy>>(`/admin/policies/${encodeURIComponent(key)}`, input);
  return response.data.data;
}
