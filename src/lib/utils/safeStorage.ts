import type { StateStorage } from "zustand/middleware";

const memoryFallback = new Map<string, string>();

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const probe = "__rival_storage_probe__";
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  getItem(name) {
    try {
      return browserStorage()?.getItem(name) ?? memoryFallback.get(name) ?? null;
    } catch {
      return memoryFallback.get(name) ?? null;
    }
  },
  setItem(name, value) {
    memoryFallback.set(name, value);
    try {
      browserStorage()?.setItem(name, value);
    } catch {
      // The in-memory fallback remains available for this session.
    }
  },
  removeItem(name) {
    memoryFallback.delete(name);
    try {
      browserStorage()?.removeItem(name);
    } catch {
      // Removal from the fallback is sufficient when storage is unavailable.
    }
  },
} satisfies StateStorage;

export function safeGetJson<T>(key: string, fallback: T): T {
  const raw = safeStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSetJson<T>(key: string, value: T): void {
  try {
    safeStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-critical persistence failure.
  }
}
