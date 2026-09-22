"use client";

import { useMutation } from "@tanstack/react-query";
import { validateDiscountCode } from "@/lib/api/endpoints/discountCodes";
import { createOrder } from "@/lib/api/endpoints/orders";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  ValidateDiscountCodeRequest,
  ValidateDiscountCodeResponse,
} from "@/types/api.types";

export interface CreateOrderVariables {
  request: CreateOrderRequest;
  /** Reuse the same key when retrying the same order so the backend de-duplicates it. */
  idempotencyKey: string;
}

/** `POST /orders` — never retried automatically; the UI decides when to retry with the same key. */
export function useCreateOrder() {
  return useMutation<CreateOrderResponse, unknown, CreateOrderVariables>({
    mutationKey: ["orders", "create"],
    mutationFn: ({ request, idempotencyKey }) => createOrder(request, idempotencyKey),
    retry: false,
  });
}

/** `POST /discount-codes/validate` */
export function useValidateDiscountCode() {
  return useMutation<ValidateDiscountCodeResponse, unknown, ValidateDiscountCodeRequest>({
    mutationKey: ["discount-codes", "validate"],
    mutationFn: (request) => validateDiscountCode(request),
    retry: false,
  });
}
