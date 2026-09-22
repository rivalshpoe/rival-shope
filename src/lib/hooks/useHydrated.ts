"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * `false` during SSR and the hydration render, `true` afterwards.
 * Use it to gate UI that depends on persisted browser state (cart, wishlist) so the
 * server and first client render match.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
