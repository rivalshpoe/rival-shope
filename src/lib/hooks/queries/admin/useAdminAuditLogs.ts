"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAdminAuditLogs } from "@/lib/api/endpoints/adminAuditLogs";
import type { AdminPageQuery } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminAuditLogs(query: AdminPageQuery) {
  return useQuery({
    queryKey: adminKeys.auditLogs(query),
    queryFn: () => getAdminAuditLogs(query),
    placeholderData: keepPreviousData,
  });
}
