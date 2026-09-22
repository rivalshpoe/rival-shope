"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProduct,
  getAdminProducts,
  updateAdminProduct,
} from "@/lib/api/endpoints/adminProducts";
import type { AdminProductInput, AdminProductsQuery } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminProducts(query: AdminProductsQuery) {
  return useQuery({
    queryKey: adminKeys.products.list(query),
    queryFn: () => getAdminProducts(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminProduct(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.products.detail(id ?? ""),
    queryFn: () => getAdminProduct(id!),
    enabled: Boolean(id),
  });
}

function useInvalidateProducts() {
  const queryClient = useQueryClient();
  return (id?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.products.all }),
      queryClient.invalidateQueries({ queryKey: adminKeys.categories }),
      queryClient.invalidateQueries({ queryKey: adminKeys.inventory.all }),
      queryClient.invalidateQueries({ queryKey: adminKeys.analyticsAll }),
      queryClient.invalidateQueries({ queryKey: adminKeys.notifications.all }),
      id ? queryClient.invalidateQueries({ queryKey: adminKeys.products.detail(id) }) : Promise.resolve(),
    ]);
}

export function useCreateAdminProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (input: AdminProductInput) => createAdminProduct(input),
    onSuccess: (product) => invalidate(product.id),
  });
}

export function useUpdateAdminProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminProductInput }) => updateAdminProduct(id, input),
    onSuccess: (product) => invalidate(product.id),
  });
}

export function useDeleteAdminProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: string) => deleteAdminProduct(id),
    onSuccess: (_result, id) => invalidate(id),
  });
}
