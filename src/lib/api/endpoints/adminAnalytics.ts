import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type { AdminAnalyticsQuery, AdminAnalyticsSummary } from "@/types/admin.types";

export async function getAdminAnalyticsSummary(query: AdminAnalyticsQuery = {}): Promise<AdminAnalyticsSummary> {
  if (isMockApi) return adminHandlers.getAnalyticsSummary(query);
  const response = await apiClient.get<ApiSuccess<AdminAnalyticsSummary>>("/admin/analytics/summary", { params: query });
  return response.data.data;
}
