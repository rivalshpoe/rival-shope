import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type { AdminBrand, AdminBrandInput } from "@/types/admin.types";

export async function getAdminBrands(): Promise<AdminBrand[]> {
  if (isMockApi) return adminHandlers.listBrands();
  const response = await apiClient.get<ApiSuccess<AdminBrand[]>>("/admin/brands");
  return response.data.data;
}

export async function createAdminBrand(input: AdminBrandInput): Promise<AdminBrand> {
  if (isMockApi) return adminHandlers.createBrand(input);
  const response = await apiClient.post<ApiSuccess<AdminBrand>>("/admin/brands", input);
  return response.data.data;
}

export async function updateAdminBrand(id: string, input: AdminBrandInput): Promise<AdminBrand> {
  if (isMockApi) return adminHandlers.updateBrand(id, input);
  const response = await apiClient.put<ApiSuccess<AdminBrand>>(`/admin/brands/${encodeURIComponent(id)}`, input);
  return response.data.data;
}

export async function deleteAdminBrand(id: string): Promise<void> {
  if (isMockApi) return adminHandlers.deleteBrand(id);
  await apiClient.delete(`/admin/brands/${encodeURIComponent(id)}`);
}
