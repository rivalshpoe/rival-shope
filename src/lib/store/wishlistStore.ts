import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/lib/utils/safeStorage";

interface WishlistState {
  productIds: string[];
  toggle: (productId: string) => void;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      productIds: [],
      toggle: (productId) =>
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds.filter((id) => id !== productId)
            : [...state.productIds, productId],
        })),
      clear: () => set({ productIds: [] }),
    }),
    {
      name: "rival-wishlist",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ productIds: state.productIds }),
    },
  ),
);
