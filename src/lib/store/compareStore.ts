import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_COMPARE_ITEMS } from "@/lib/constants/categories";
import { safeStorage } from "@/lib/utils/safeStorage";

interface CompareState {
  productIds: string[];
  toggle: (productId: string) => void;
  clear: () => void;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      productIds: [],
      toggle: (productId) =>
        set((state) => {
          if (state.productIds.includes(productId)) {
            return { productIds: state.productIds.filter((id) => id !== productId) };
          }
          if (state.productIds.length >= MAX_COMPARE_ITEMS) return state;
          return { productIds: [...state.productIds, productId] };
        }),
      clear: () => set({ productIds: [] }),
    }),
    {
      name: "rival-compare",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ productIds: state.productIds }),
    },
  ),
);
