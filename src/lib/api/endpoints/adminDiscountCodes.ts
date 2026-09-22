import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type { AdminDiscountCode, AdminDiscountCodeInput } from "@/types/admin.types";

export async function getAdminDiscountCodes(): Promise<AdminDiscountCode[]> {
  if (isMockApi) return adminHandlers.listDiscountCodes();
  const response = await apiClient.get<ApiSuccess<AdminDiscountCode[]>>("/admin/discount-codes");
  return response.data.data;
}

export async function createAdminDiscountCode(input: AdminDiscountCodeInput): Promise<AdminDiscountCode> {
  if (isMockApi) return adminHandlers.createDiscountCode(input);
  const response = await apiClient.post<ApiSuccess<AdminDiscountCode>>("/admin/discount-codes", input);
  return response.data.data;
}

export async function updateAdminDiscountCode(id: string, input: AdminDiscountCodeInput): Promise<AdminDiscountCode> {
  if (isMockApi) return adminHandlers.updateDiscountCode(id, input);
  const response = await apiClient.put<ApiSuccess<AdminDiscountCode>>(`/admin/discount-codes/${encodeURIComponent(id)}`, input);
  return response.data.data;
}

export async function deleteAdminDiscountCode(id: string): Promise<void> {
  if (isMockApi) return adminHandlers.deleteDiscountCode(id);
  await apiClient.delete(`/admin/discount-codes/${encodeURIComponent(id)}`);
}
