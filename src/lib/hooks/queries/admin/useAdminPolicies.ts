"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminPolicies, updateAdminPolicy } from "@/lib/api/endpoints/adminPolicies";
import type { AdminPolicyInput, PolicyKey } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminPolicies() {
  return useQuery({ queryKey: adminKeys.policies, queryFn: getAdminPolicies, staleTime: 60_000 });
}

export function useUpdateAdminPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: PolicyKey; input: AdminPolicyInput }) => updateAdminPolicy(key, input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.policies }),
        queryClient.invalidateQueries({ queryKey: adminKeys.auditLogsAll }),
      ]),
  });
}
