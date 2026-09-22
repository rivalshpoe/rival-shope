"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminDiscountCode,
  deleteAdminDiscountCode,
  getAdminDiscountCodes,
  updateAdminDiscountCode,
} from "@/lib/api/endpoints/adminDiscountCodes";
import type { AdminDiscountCodeInput } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminDiscountCodes() {
  return useQuery({ queryKey: adminKeys.discountCodes, queryFn: getAdminDiscountCodes, staleTime: 30_000 });
}

function useInvalidateCodes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.discountCodes });
}

export function useCreateAdminDiscountCode() {
  const invalidate = useInvalidateCodes();
  return useMutation({ mutationFn: (input: AdminDiscountCodeInput) => createAdminDiscountCode(input), onSuccess: () => invalidate() });
}

export function useUpdateAdminDiscountCode() {
  const invalidate = useInvalidateCodes();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminDiscountCodeInput }) => updateAdminDiscountCode(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAdminDiscountCode() {
  const invalidate = useInvalidateCodes();
  return useMutation({ mutationFn: (id: string) => deleteAdminDiscountCode(id), onSuccess: () => invalidate() });
}
