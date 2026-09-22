import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiListData, ApiListResponse, ApiSuccess } from "@/types/api.types";
import type { AdminNotification, AdminNotificationsQuery } from "@/types/admin.types";

export async function getAdminNotifications(query: AdminNotificationsQuery = {}): Promise<ApiListData<AdminNotification>> {
  if (isMockApi) return adminHandlers.listNotifications(query);
  const response = await apiClient.get<ApiListResponse<AdminNotification>>("/admin/notifications", { params: query });
  return response.data.data;
}

export async function resolveAdminNotification(id: string): Promise<AdminNotification> {
  if (isMockApi) return adminHandlers.resolveNotification(id);
  const response = await apiClient.patch<ApiSuccess<AdminNotification>>(`/admin/notifications/${encodeURIComponent(id)}/resolve`);
  return response.data.data;
}
