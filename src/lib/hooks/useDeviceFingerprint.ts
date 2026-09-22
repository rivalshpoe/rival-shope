"use client";

import { useSyncExternalStore } from "react";
import { generateUuid } from "@/lib/utils/generateUuid";
import { safeStorage } from "@/lib/utils/safeStorage";

const DEVICE_ID_KEY = "rival-device-id";
let sessionDeviceId: string | null = null;
let cachedFingerprint: string | null = null;

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function getDeviceFingerprint(): string | null {
  if (typeof window === "undefined") return null;
  if (cachedFingerprint) return cachedFingerprint;

  let deviceId = safeStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = sessionDeviceId ?? generateUuid();
    sessionDeviceId = deviceId;
    safeStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  const signals = [
    deviceId,
    `${window.screen.width}x${window.screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    window.navigator.userAgent,
  ].join("|");
  cachedFingerprint = `${deviceId}.${simpleHash(signals)}`;
  return cachedFingerprint;
}

export function useDeviceFingerprint(): string | null {
  return useSyncExternalStore(
    () => () => undefined,
    getDeviceFingerprint,
    () => null,
  );
}
