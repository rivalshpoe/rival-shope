import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem } from "@/types/domain.types";
import { MAX_LINE_QUANTITY } from "@/lib/constants/categories";
import { safeStorage } from "@/lib/utils/safeStorage";

const STORAGE_KEY = "rival-cart";
const itemKey = (item: Pick<CartItem, "product" | "sizeId" | "colorId">) =>
  `${item.product.id}:${item.sizeId ?? "-"}:${item.colorId ?? "-"}`;

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const key = itemKey(item);
          const existing = state.items.find((candidate) => itemKey(candidate) === key);
          return {
            items: existing
              ? state.items.map((candidate) =>
                  itemKey(candidate) === key
                    ? { ...candidate, quantity: Math.min(MAX_LINE_QUANTITY, candidate.quantity + item.quantity) }
                    : candidate,
                )
              : [...state.items, { ...item, quantity: Math.max(1, item.quantity) }],
          };
        }),
      removeItem: (key) =>
        set((state) => ({ items: state.items.filter((item) => itemKey(item) !== key) })),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((item) => itemKey(item) !== key)
              : state.items.map((item) =>
                  itemKey(item) === key ? { ...item, quantity } : item,
                ),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) void useCartStore.persist.rehydrate();
  });
}

export { itemKey as getCartItemKey };
