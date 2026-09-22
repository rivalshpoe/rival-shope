import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiListData, ApiListResponse, ApiSuccess } from "@/types/api.types";
import type {
  AdminProductDetails,
  AdminProductInput,
  AdminProductRow,
  AdminProductsQuery,
} from "@/types/admin.types";

export async function getAdminProducts(query: AdminProductsQuery = {}): Promise<ApiListData<AdminProductRow>> {
  if (isMockApi) return adminHandlers.listProducts(query);
  const response = await apiClient.get<ApiListResponse<AdminProductRow>>("/admin/products", { params: query });
  return response.data.data;
}

export async function getAdminProduct(id: string): Promise<AdminProductDetails> {
  if (isMockApi) return adminHandlers.getProduct(id);
  const response = await apiClient.get<ApiSuccess<AdminProductDetails>>(`/admin/products/${encodeURIComponent(id)}`);
  return response.data.data;
}

export async function createAdminProduct(input: AdminProductInput): Promise<AdminProductDetails> {
  if (isMockApi) return adminHandlers.createProduct(input);
  const response = await apiClient.post<ApiSuccess<AdminProductDetails>>("/admin/products", input);
  return response.data.data;
}

export async function updateAdminProduct(id: string, input: AdminProductInput): Promise<AdminProductDetails> {
  if (isMockApi) return adminHandlers.updateProduct(id, input);
  const response = await apiClient.put<ApiSuccess<AdminProductDetails>>(`/admin/products/${encodeURIComponent(id)}`, input);
  return response.data.data;
}

export async function deleteAdminProduct(id: string): Promise<void> {
  if (isMockApi) return adminHandlers.deleteProduct(id);
  await apiClient.delete(`/admin/products/${encodeURIComponent(id)}`);
}
