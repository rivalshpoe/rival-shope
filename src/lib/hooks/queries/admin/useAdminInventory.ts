"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminInventory,
  getAdminInventoryHistory,
  restockAdminInventory,
} from "@/lib/api/endpoints/adminInventory";
import type { AdminInventoryHistoryQuery, AdminInventoryQuery, AdminRestockRequest } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminInventory(query: AdminInventoryQuery) {
  return useQuery({
    queryKey: adminKeys.inventory.list(query),
    queryFn: () => getAdminInventory(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminInventoryHistory(productId: string, query: AdminInventoryHistoryQuery) {
  return useQuery({
    queryKey: adminKeys.inventory.history(productId, query),
    queryFn: () => getAdminInventoryHistory(productId, query),
    placeholderData: keepPreviousData,
    enabled: Boolean(productId),
  });
}

export function useRestockAdminInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AdminRestockRequest) => restockAdminInventory(request),
    onSuccess: (_result, request) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.inventory.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.products.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.products.detail(request.productId) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.analyticsAll }),
        queryClient.invalidateQueries({ queryKey: adminKeys.notifications.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.auditLogsAll }),
      ]),
  });
}
