import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type { AdminDeliveryZone, AdminDeliveryZoneInput } from "@/types/admin.types";

export async function getAdminDeliveryZones(): Promise<AdminDeliveryZone[]> {
  if (isMockApi) return adminHandlers.listDeliveryZones();
  const response = await apiClient.get<ApiSuccess<AdminDeliveryZone[]>>("/admin/delivery-zones");
  return response.data.data;
}

export async function createAdminDeliveryZone(input: AdminDeliveryZoneInput): Promise<AdminDeliveryZone> {
  if (isMockApi) return adminHandlers.createDeliveryZone(input);
  const response = await apiClient.post<ApiSuccess<AdminDeliveryZone>>("/admin/delivery-zones", input);
  return response.data.data;
}

export async function updateAdminDeliveryZone(id: string, input: AdminDeliveryZoneInput): Promise<AdminDeliveryZone> {
  if (isMockApi) return adminHandlers.updateDeliveryZone(id, input);
  const response = await apiClient.put<ApiSuccess<AdminDeliveryZone>>(`/admin/delivery-zones/${encodeURIComponent(id)}`, input);
  return response.data.data;
}

export async function deleteAdminDeliveryZone(id: string): Promise<void> {
  if (isMockApi) return adminHandlers.deleteDeliveryZone(id);
  await apiClient.delete(`/admin/delivery-zones/${encodeURIComponent(id)}`);
}
