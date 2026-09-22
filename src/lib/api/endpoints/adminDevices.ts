import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiListData, ApiListResponse, ApiSuccess } from "@/types/api.types";
import type { AdminBlockDeviceRequest, AdminDevice, AdminDevicesQuery } from "@/types/admin.types";

export async function getAdminDevices(query: AdminDevicesQuery = {}): Promise<ApiListData<AdminDevice>> {
  if (isMockApi) return adminHandlers.listDevices(query);
  const response = await apiClient.get<ApiListResponse<AdminDevice>>("/admin/devices", { params: query });
  return response.data.data;
}

export async function setAdminDeviceBlocked(id: string, request: AdminBlockDeviceRequest): Promise<AdminDevice> {
  if (isMockApi) return adminHandlers.setDeviceBlocked(id, request);
  const response = await apiClient.patch<ApiSuccess<AdminDevice>>(`/admin/devices/${encodeURIComponent(id)}/block`, request);
  return response.data.data;
}
