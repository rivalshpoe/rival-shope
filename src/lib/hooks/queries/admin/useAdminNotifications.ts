"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminNotifications, resolveAdminNotification } from "@/lib/api/endpoints/adminNotifications";
import type { AdminNotificationsQuery } from "@/types/admin.types";
import { adminKeys } from "./keys";

export const NOTIFICATIONS_POLL_MS = 15_000;

export function useAdminNotifications(query: AdminNotificationsQuery, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: adminKeys.notifications.list(query),
    queryFn: () => getAdminNotifications(query),
    placeholderData: keepPreviousData,
    refetchInterval: options.poll ? NOTIFICATIONS_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/** Unresolved notifications for the header bell — polled every 15s. */
export function useUnresolvedNotifications() {
  return useAdminNotifications({ unresolvedOnly: true, page: 1, pageSize: 50 }, { poll: true });
}

export function useResolveAdminNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resolveAdminNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.notifications.all }),
  });
}
