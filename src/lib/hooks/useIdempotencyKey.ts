"use client";

import { useCallback } from "react";
import { useCheckoutStore } from "@/lib/store/checkoutStore";
import { generateUuid } from "@/lib/utils/generateUuid";

/**
 * Idempotency key for the order being placed.
 * - `getKey()` returns the current key, minting one on first use.
 * - The key is persisted with the checkout form so a retry after a failure, refresh or
 *   lost connection reuses the same key (backend de-duplicates the order).
 * - Call `reset()` once the server confirms the order so the next order gets a fresh key.
 */
export function useIdempotencyKey() {
  const storedKey = useCheckoutStore((state) => state.idempotencyKey);
  const setStoredKey = useCheckoutStore((state) => state.setIdempotencyKey);

  const getKey = useCallback(() => {
    const current = useCheckoutStore.getState().idempotencyKey;
    if (current) return current;
    const fresh = generateUuid();
    setStoredKey(fresh);
    return fresh;
  }, [setStoredKey]);

  const reset = useCallback(() => {
    const fresh = generateUuid();
    setStoredKey(fresh);
    return fresh;
  }, [setStoredKey]);

  const clear = useCallback(() => setStoredKey(null), [setStoredKey]);

  return { key: storedKey, getKey, reset, clear };
}
