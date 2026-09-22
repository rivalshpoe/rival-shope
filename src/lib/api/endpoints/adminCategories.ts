import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type { AdminCategory, AdminCategoryInput } from "@/types/admin.types";

export async function getAdminCategories(): Promise<AdminCategory[]> {
  if (isMockApi) return adminHandlers.listCategories();
  const response = await apiClient.get<ApiSuccess<AdminCategory[]>>("/admin/categories");
  return response.data.data;
}

export async function createAdminCategory(input: AdminCategoryInput): Promise<AdminCategory> {
  if (isMockApi) return adminHandlers.createCategory(input);
  const response = await apiClient.post<ApiSuccess<AdminCategory>>("/admin/categories", input);
  return response.data.data;
}

export async function updateAdminCategory(id: string, input: AdminCategoryInput): Promise<AdminCategory> {
  if (isMockApi) return adminHandlers.updateCategory(id, input);
  const response = await apiClient.put<ApiSuccess<AdminCategory>>(`/admin/categories/${encodeURIComponent(id)}`, input);
  return response.data.data;
}

export async function deleteAdminCategory(id: string): Promise<void> {
  if (isMockApi) return adminHandlers.deleteCategory(id);
  await apiClient.delete(`/admin/categories/${encodeURIComponent(id)}`);
}
