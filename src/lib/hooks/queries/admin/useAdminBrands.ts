"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminBrand,
  deleteAdminBrand,
  getAdminBrands,
  updateAdminBrand,
} from "@/lib/api/endpoints/adminBrands";
import type { AdminBrandInput } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminBrands() {
  return useQuery({
    queryKey: adminKeys.brands,
    queryFn: getAdminBrands,
    staleTime: 60_000,
  });
}

function useInvalidateBrands() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.brands }),
      queryClient.invalidateQueries({ queryKey: adminKeys.products.all }),
    ]);
}

export function useCreateAdminBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: (input: AdminBrandInput) => createAdminBrand(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateAdminBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminBrandInput }) => updateAdminBrand(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAdminBrand() {
  const invalidate = useInvalidateBrands();
  return useMutation({
    mutationFn: (id: string) => deleteAdminBrand(id),
    onSuccess: () => invalidate(),
  });
}
