import axios from "axios";
import { getDeviceFingerprint } from "@/lib/hooks/useDeviceFingerprint";
import { useAdminAuthStore } from "@/lib/store/adminAuthStore";
import { generateUuid } from "@/lib/utils/generateUuid";
import { ROUTES } from "@/lib/constants/routes";
import { toAppError } from "./errors";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1",
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: "application/json" },
});

function isAdminRequest(url?: string): boolean {
  if (!url) return false;
  try {
    const path = new URL(url, "http://rival.local").pathname;
    return /(?:^|\/)admin(?:\/|$)/.test(path);
  } catch {
    return url.includes("/admin/");
  }
}

apiClient.interceptors.request.use((config) => {
  config.headers.set("X-Correlation-Id", generateUuid());

  if (isAdminRequest(config.url)) {
    const token = useAdminAuthStore.getState().getValidToken();
    if (token) config.headers.set("Authorization", `Bearer ${token}`);
  } else {
    const fingerprint = getDeviceFingerprint();
    if (fingerprint) config.headers.set("X-Device-Fingerprint", fingerprint);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const appError = toAppError(error);
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      isAdminRequest(error.config?.url)
    ) {
      useAdminAuthStore.getState().clearSession(true);
      if (typeof window !== "undefined") window.location.assign(ROUTES.adminLogin);
    }
    return Promise.reject(appError);
  },
);
