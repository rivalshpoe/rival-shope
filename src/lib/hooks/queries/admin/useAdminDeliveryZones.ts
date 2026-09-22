"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminDeliveryZone,
  deleteAdminDeliveryZone,
  getAdminDeliveryZones,
  updateAdminDeliveryZone,
} from "@/lib/api/endpoints/adminDeliveryZones";
import type { AdminDeliveryZoneInput } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminDeliveryZones() {
  return useQuery({ queryKey: adminKeys.deliveryZones, queryFn: getAdminDeliveryZones, staleTime: 60_000 });
}

function useInvalidateZones() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.deliveryZones });
}

export function useCreateAdminDeliveryZone() {
  const invalidate = useInvalidateZones();
  return useMutation({ mutationFn: (input: AdminDeliveryZoneInput) => createAdminDeliveryZone(input), onSuccess: () => invalidate() });
}

export function useUpdateAdminDeliveryZone() {
  const invalidate = useInvalidateZones();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminDeliveryZoneInput }) => updateAdminDeliveryZone(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAdminDeliveryZone() {
  const invalidate = useInvalidateZones();
  return useMutation({ mutationFn: (id: string) => deleteAdminDeliveryZone(id), onSuccess: () => invalidate() });
}
