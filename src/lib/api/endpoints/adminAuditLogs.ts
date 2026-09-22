import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiListData, ApiListResponse } from "@/types/api.types";
import type { AdminAuditLog, AdminPageQuery } from "@/types/admin.types";

export async function getAdminAuditLogs(query: AdminPageQuery = {}): Promise<ApiListData<AdminAuditLog>> {
  if (isMockApi) return adminHandlers.listAuditLogs(query);
  const response = await apiClient.get<ApiListResponse<AdminAuditLog>>("/admin/audit-logs", { params: query });
  return response.data.data;
}
