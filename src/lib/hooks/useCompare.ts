"use client";

import { MAX_COMPARE_ITEMS } from "@/lib/constants/categories";
import { useCompareStore } from "@/lib/store/compareStore";

export function useCompare() {
  const store = useCompareStore();
  return {
    ...store,
    has: (productId: string) => store.productIds.includes(productId),
    isFull: store.productIds.length >= MAX_COMPARE_ITEMS,
  };
}
