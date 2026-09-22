import { apiClient } from "@/lib/api/client";
import { isMockApi, publicHandlers } from "@/lib/mock/adapter";
import type { ApiSuccess, CreateOrderRequest, CreateOrderResponse } from "@/types/api.types";

/**
 * `POST /orders` — the same `idempotencyKey` must be reused when retrying the same order
 * so the backend can de-duplicate. `X-Device-Fingerprint` is attached by the client interceptor.
 */
export async function createOrder(
  request: CreateOrderRequest,
  idempotencyKey: string,
): Promise<CreateOrderResponse> {
  if (isMockApi) return publicHandlers.createOrder(request);
  const response = await apiClient.post<ApiSuccess<CreateOrderResponse>>("/orders", request, {
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return response.data.data;
}
