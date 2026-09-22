"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveAdminReview,
  createAdminReview,
  deleteAdminReview,
  getAdminReviews,
  updateAdminReview,
} from "@/lib/api/endpoints/adminReviews";
import type { AdminReviewInput, AdminReviewsQuery } from "@/types/admin.types";
import { adminKeys } from "./keys";

export function useAdminReviews(query: AdminReviewsQuery) {
  return useQuery({
    queryKey: adminKeys.reviews.list(query),
    queryFn: () => getAdminReviews(query),
    placeholderData: keepPreviousData,
  });
}

const LOOKUP_QUERY: AdminReviewsQuery = { page: 1, pageSize: 200 };

/**
 * The contract exposes no `GET /admin/reviews/{id}`; the edit page resolves a
 * single review from the (cached) list instead.
 */
export function useAdminReview(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.reviews.list(LOOKUP_QUERY),
    queryFn: () => getAdminReviews(LOOKUP_QUERY),
    enabled: Boolean(id),
    select: (data) => data.items.find((review) => review.id === id) ?? null,
  });
}

function useInvalidateReviews() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.reviews.all });
}

export function useCreateAdminReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({ mutationFn: (input: AdminReviewInput) => createAdminReview(input), onSuccess: () => invalidate() });
}

export function useUpdateAdminReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AdminReviewInput }) => updateAdminReview(id, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAdminReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({ mutationFn: (id: string) => deleteAdminReview(id), onSuccess: () => invalidate() });
}

export function useApproveAdminReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) => approveAdminReview(id, isApproved),
    onSuccess: () => invalidate(),
  });
}
