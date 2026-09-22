import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiListData, ApiListResponse, ApiSuccess } from "@/types/api.types";
import type {
  AdminCollectOrdersRequest,
  AdminCollectOrdersResponse,
  AdminOrderDetails,
  AdminOrderRow,
  AdminOrdersQuery,
  AdminPageQuery,
  AdminUpdateOrderStatusRequest,
} from "@/types/admin.types";

export async function getAdminOrders(query: AdminOrdersQuery = {}): Promise<ApiListData<AdminOrderRow>> {
  if (isMockApi) return adminHandlers.listOrders(query);
  const response = await apiClient.get<ApiListResponse<AdminOrderRow>>("/admin/orders", { params: query });
  return response.data.data;
}

export async function getAdminOrder(id: string): Promise<AdminOrderDetails> {
  if (isMockApi) return adminHandlers.getOrder(id);
  const response = await apiClient.get<ApiSuccess<AdminOrderDetails>>(`/admin/orders/${encodeURIComponent(id)}`);
  return response.data.data;
}

export async function updateAdminOrderStatus(id: string, request: AdminUpdateOrderStatusRequest): Promise<AdminOrderDetails> {
  if (isMockApi) return adminHandlers.updateOrderStatus(id, request);
  const response = await apiClient.patch<ApiSuccess<AdminOrderDetails>>(`/admin/orders/${encodeURIComponent(id)}/status`, request);
  return response.data.data;
}

export async function collectAdminOrders(request: AdminCollectOrdersRequest): Promise<AdminCollectOrdersResponse> {
  if (isMockApi) return adminHandlers.collectOrders(request);
  const response = await apiClient.patch<ApiSuccess<AdminCollectOrdersResponse>>("/admin/orders/collect", request);
  return response.data.data;
}

export async function getCollectedAdminOrders(query: AdminPageQuery = {}): Promise<ApiListData<AdminOrderRow>> {
  if (isMockApi) return adminHandlers.listCollectedOrders(query);
  const response = await apiClient.get<ApiListResponse<AdminOrderRow>>("/admin/orders/collected", { params: query });
  return response.data.data;
}
