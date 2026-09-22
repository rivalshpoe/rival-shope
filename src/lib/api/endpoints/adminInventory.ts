import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiListData, ApiListResponse, ApiSuccess } from "@/types/api.types";
import type {
  AdminInventoryHistoryQuery,
  AdminInventoryQuery,
  AdminInventoryRow,
  AdminRestockRequest,
  AdminRestockResponse,
  InventoryLog,
} from "@/types/admin.types";

export async function getAdminInventory(query: AdminInventoryQuery = {}): Promise<ApiListData<AdminInventoryRow>> {
  if (isMockApi) return adminHandlers.listInventory(query);
  const response = await apiClient.get<ApiListResponse<AdminInventoryRow>>("/admin/inventory", { params: query });
  return response.data.data;
}

export async function restockAdminInventory(request: AdminRestockRequest): Promise<AdminRestockResponse> {
  if (isMockApi) return adminHandlers.restockInventory(request);
  const response = await apiClient.post<ApiSuccess<AdminRestockResponse>>("/admin/inventory/restock", request);
  return response.data.data;
}

export async function getAdminInventoryHistory(
  productId: string,
  query: AdminInventoryHistoryQuery = {},
): Promise<ApiListData<InventoryLog>> {
  if (isMockApi) return adminHandlers.getInventoryHistory(productId, query);
  const response = await apiClient.get<ApiListResponse<InventoryLog>>(
    `/admin/inventory/${encodeURIComponent(productId)}/history`,
    { params: query },
  );
  return response.data.data;
}
