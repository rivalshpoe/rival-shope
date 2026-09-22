"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "@/lib/api/endpoints/adminCategories";
import type { AdminCategoryInput } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminCategories() {
  return useQuery({
    queryKey: adminKeys.categories,
    queryFn: getAdminCategories,
    staleTime: 60_000,
  });
}

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.categories }),
      queryClient.invalidateQueries({ queryKey: adminKeys.products.all }),
    ]);
}

export function useCreateAdminCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (input: AdminCategoryInput) => createAdminCategory(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateAdminCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminCategoryInput }) => updateAdminCategory(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAdminCategory() {
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (id: string) => deleteAdminCategory(id),
    onSuccess: () => invalidate(),
  });
}
