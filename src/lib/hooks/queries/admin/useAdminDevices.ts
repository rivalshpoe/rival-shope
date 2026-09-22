"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminDevices, setAdminDeviceBlocked } from "@/lib/api/endpoints/adminDevices";
import type { AdminBlockDeviceRequest, AdminDevicesQuery } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminDevices(query: AdminDevicesQuery) {
  return useQuery({
    queryKey: adminKeys.devices.list(query),
    queryFn: () => getAdminDevices(query),
    placeholderData: keepPreviousData,
  });
}

export function useSetAdminDeviceBlocked() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: AdminBlockDeviceRequest }) => setAdminDeviceBlocked(id, request),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.devices.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.orders.all }),
        queryClient.invalidateQueries({ queryKey: adminKeys.auditLogsAll }),
      ]),
  });
}
