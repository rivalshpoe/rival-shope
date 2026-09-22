"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  collectAdminOrders,
  getAdminOrder,
  getAdminOrders,
  getCollectedAdminOrders,
  updateAdminOrderStatus,
} from "@/lib/api/endpoints/adminOrders";
import type {
  AdminCollectOrdersRequest,
  AdminOrdersQuery,
  AdminPageQuery,
  AdminUpdateOrderStatusRequest,
} from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminOrders(query: AdminOrdersQuery) {
  return useQuery({
    queryKey: adminKeys.orders.list(query),
    queryFn: () => getAdminOrders(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrder(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.orders.detail(id ?? ""),
    queryFn: () => getAdminOrder(id!),
    enabled: Boolean(id),
  });
}

export function useCollectedAdminOrders(query: AdminPageQuery) {
  return useQuery({
    queryKey: adminKeys.orders.collected(query),
    queryFn: () => getCollectedAdminOrders(query),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateAdminOrderStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AdminUpdateOrderStatusRequest) => updateAdminOrderStatus(id, request),
    onSuccess: (details) => {
      queryClient.setQueryData(adminKeys.orders.detail(id), details);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.orders.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.analyticsAll }),
        queryClient.invalidateQueries({ queryKey: adminKeys.notifications.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.devices.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.auditLogsAll }),
      ]);
    },
  });
}

export function useCollectAdminOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AdminCollectOrdersRequest) => collectAdminOrders(request),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.orders.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.analyticsAll }),
        queryClient.invalidateQueries({ queryKey: adminKeys.auditLogsAll }),
      ]),
  });
}
