import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiListData, ApiListResponse, ApiSuccess } from "@/types/api.types";
import type { AdminReview, AdminReviewInput, AdminReviewsQuery } from "@/types/admin.types";

export async function getAdminReviews(query: AdminReviewsQuery = {}): Promise<ApiListData<AdminReview>> {
  if (isMockApi) return adminHandlers.listReviews(query);
  const response = await apiClient.get<ApiListResponse<AdminReview>>("/admin/reviews", { params: query });
  return response.data.data;
}

export async function createAdminReview(input: AdminReviewInput): Promise<AdminReview> {
  if (isMockApi) return adminHandlers.createReview(input);
  const response = await apiClient.post<ApiSuccess<AdminReview>>("/admin/reviews", input);
  return response.data.data;
}

export async function updateAdminReview(id: string, input: AdminReviewInput): Promise<AdminReview> {
  if (isMockApi) return adminHandlers.updateReview(id, input);
  const response = await apiClient.put<ApiSuccess<AdminReview>>(`/admin/reviews/${encodeURIComponent(id)}`, input);
  return response.data.data;
}

export async function deleteAdminReview(id: string): Promise<void> {
  if (isMockApi) return adminHandlers.deleteReview(id);
  await apiClient.delete(`/admin/reviews/${encodeURIComponent(id)}`);
}

export async function approveAdminReview(id: string, isApproved: boolean): Promise<AdminReview> {
  if (isMockApi) return adminHandlers.approveReview(id, isApproved);
  const response = await apiClient.patch<ApiSuccess<AdminReview>>(`/admin/reviews/${encodeURIComponent(id)}/approve`, { isApproved });
  return response.data.data;
}
