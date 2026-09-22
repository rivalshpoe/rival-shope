import { apiClient } from "@/lib/api/client";
import { isMockApi } from "@/lib/mock/adapter";
import { adminHandlers } from "@/lib/mock/adminHandlers";
import type { ApiSuccess } from "@/types/api.types";
import type { AdminUploadResponse } from "@/types/admin.types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** `POST /admin/uploads/images` — multipart field `file` (≤5MB). Always returns WebP urls. */
export async function uploadAdminImage(file: File): Promise<AdminUploadResponse> {
  if (isMockApi) return adminHandlers.uploadImage(file);
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<ApiSuccess<AdminUploadResponse>>("/admin/uploads/images", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60_000,
  });
  return response.data.data;
}
