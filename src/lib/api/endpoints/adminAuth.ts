import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type {
  AdminMeResponse,
  AdminRefreshResponse,
  AdminRequestOtpRequest,
  AdminRequestOtpResponse,
  AdminVerifyOtpRequest,
  AdminVerifyOtpResponse,
} from "@/types/admin.types";

export async function requestAdminOtp(request: AdminRequestOtpRequest): Promise<AdminRequestOtpResponse> {
  if (isMockApi) return adminHandlers.requestOtp(request);
  const response = await apiClient.post<ApiSuccess<AdminRequestOtpResponse>>("/admin/auth/request-otp", request);
  return response.data.data;
}

export async function verifyAdminOtp(request: AdminVerifyOtpRequest): Promise<AdminVerifyOtpResponse> {
  if (isMockApi) return adminHandlers.verifyOtp(request);
  const response = await apiClient.post<ApiSuccess<AdminVerifyOtpResponse>>("/admin/auth/verify-otp", request);
  return response.data.data;
}

export async function refreshAdminSession(): Promise<AdminRefreshResponse> {
  if (isMockApi) return adminHandlers.refresh();
  const response = await apiClient.post<ApiSuccess<AdminRefreshResponse>>("/admin/auth/refresh");
  return response.data.data;
}

export async function logoutAdmin(): Promise<void> {
  if (isMockApi) return adminHandlers.logout();
  await apiClient.post("/admin/auth/logout");
}

export async function getAdminMe(): Promise<AdminMeResponse> {
  if (isMockApi) return adminHandlers.me();
  const response = await apiClient.get<ApiSuccess<AdminMeResponse>>("/admin/auth/me");
  return response.data.data;
}
