"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminAnalyticsSummary } from "@/lib/api/endpoints/adminAnalytics";
import type { AdminAnalyticsQuery } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminAnalyticsSummary(query: AdminAnalyticsQuery = {}) {
  return useQuery({
    queryKey: adminKeys.analytics(query),
    queryFn: () => getAdminAnalyticsSummary(query),
    staleTime: 30_000,
  });
}
