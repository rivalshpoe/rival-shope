"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getEffectivePrice } from "@/lib/api/endpoints/products";
import { MAX_LINE_QUANTITY } from "@/lib/constants/categories";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { getCartItemKey, useCartStore } from "@/lib/store/cartStore";
import { useCompareStore } from "@/lib/store/compareStore";
import { useWishlistStore } from "@/lib/store/wishlistStore";
import type { ProductListItem } from "@/types/api.types";
import type { CartItem } from "@/types/domain.types";

export interface CartLine extends CartItem {
  /** Stable key: productId + sizeId + colorId. */
  key: string;
  /** Unit price actually charged for this line. */
  unitPrice: number;
  lineTotal: number;
}

export interface AddToCartOptions {
  sizeId?: string | null;
  sizeLabel?: string | null;
  colorId?: string | null;
  colorName?: string | null;
  /** Size-specific price; falls back to the product's effective price. */
  unitPrice?: number;
  quantity?: number;
}

type ShopContextValue = {
  /** `false` until persisted browser state has hydrated — render neutral UI before that. */
  hydrated: boolean;
  cart: CartLine[];
  cartCount: number;
  subtotal: number;
  wishlist: string[];
  compare: string[];
  cartOpen: boolean;
  menuOpen: boolean;
  brandOpen: boolean;
  quickViewId: string | null;
  addToCart: (product: ProductListItem, options?: AddToCartOptions) => void;
  removeLine: (key: string) => void;
  setLineQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  toggleWishlist: (id: string) => void;
  toggleCompare: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setBrandOpen: (open: boolean) => void;
  setQuickViewId: (id: string | null) => void;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const storedCart = useCartStore((state) => state.items);
  const addStoredItem = useCartStore((state) => state.addItem);
  const removeStoredItem = useCartStore((state) => state.removeItem);
  const setStoredQuantity = useCartStore((state) => state.setQuantity);
  const clearStoredCart = useCartStore((state) => state.clear);
  const storedWishlist = useWishlistStore((state) => state.productIds);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const storedCompare = useCompareStore((state) => state.productIds);
  const toggleCompare = useCompareStore((state) => state.toggle);

  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCartOpen(false);
      setMenuOpen(false);
      setBrandOpen(false);
      setQuickViewId(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const cart = useMemo<CartLine[]>(() => {
    if (!hydrated) return [];
    return storedCart.map((item) => {
      const unitPrice = item.unitPrice ?? getEffectivePrice(item.product);
      return { ...item, key: getCartItemKey(item), unitPrice, lineTotal: unitPrice * item.quantity };
    });
  }, [hydrated, storedCart]);

  const addToCart = useCallback(
    (product: ProductListItem, options: AddToCartOptions = {}) => {
      addStoredItem({
        product,
        sizeId: options.sizeId ?? null,
        colorId: options.colorId ?? null,
        sizeLabel: options.sizeLabel ?? null,
        colorName: options.colorName ?? null,
        unitPrice: options.unitPrice ?? getEffectivePrice(product),
        quantity: Math.max(1, Math.min(MAX_LINE_QUANTITY, options.quantity ?? 1)),
      });
    },
    [addStoredItem],
  );

  const setLineQuantity = useCallback(
    (key: string, quantity: number) => setStoredQuantity(key, Math.max(0, Math.min(MAX_LINE_QUANTITY, quantity))),
    [setStoredQuantity],
  );

  const value = useMemo<ShopContextValue>(
    () => ({
      hydrated,
      cart,
      cartCount: cart.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: cart.reduce((sum, line) => sum + line.lineTotal, 0),
      wishlist: hydrated ? storedWishlist : [],
      compare: hydrated ? storedCompare : [],
      cartOpen,
      menuOpen,
      brandOpen,
      quickViewId,
      addToCart,
      removeLine: removeStoredItem,
      setLineQuantity,
      clearCart: clearStoredCart,
      toggleWishlist,
      toggleCompare,
      setCartOpen,
      setMenuOpen,
      setBrandOpen,
      setQuickViewId,
    }),
    [
      addToCart, brandOpen, cart, cartOpen, clearStoredCart, hydrated, menuOpen, quickViewId,
      removeStoredItem, setLineQuantity, storedCompare, storedWishlist, toggleCompare, toggleWishlist,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error("useShop must be used inside ShopProvider");
  return value;
}
