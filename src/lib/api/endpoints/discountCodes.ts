import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type {
  ApiSuccess,
  ValidateDiscountCodeRequest,
  ValidateDiscountCodeResponse,
} from "@/types/api.types";

/** `POST /discount-codes/validate` */
export async function validateDiscountCode(
  request: ValidateDiscountCodeRequest,
): Promise<ValidateDiscountCodeResponse> {
  const normalized: ValidateDiscountCodeRequest = {
    code: request.code.trim().toUpperCase(),
    subtotal: request.subtotal,
  };
  if (isMockApi) return publicHandlers.validateDiscountCode(normalized.code, normalized.subtotal);
  const response = await apiClient.post<ApiSuccess<ValidateDiscountCodeResponse>>(
    "/discount-codes/validate",
    normalized,
  );
  return response.data.data;
}
