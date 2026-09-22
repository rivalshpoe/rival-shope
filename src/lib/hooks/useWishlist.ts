"use client";

import { useWishlistStore } from "@/lib/store/wishlistStore";

export function useWishlist() {
  const store = useWishlistStore();
  return {
    ...store,
    has: (productId: string) => store.productIds.includes(productId),
  };
}
