"use client";

import { getEffectivePrice } from "@/lib/api/endpoints/products";
import { useCartStore } from "@/lib/store/cartStore";

export function useCart() {
  const store = useCartStore();
  const itemCount = store.items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = store.items.reduce((total, item) => {
    const unitPrice = item.unitPrice ?? getEffectivePrice(item.product);
    return total + unitPrice * item.quantity;
  }, 0);
  return { ...store, itemCount, subtotal };
}
