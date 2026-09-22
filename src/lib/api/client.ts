import axios, { type InternalAxiosRequestConfig } from "axios";
import { getDeviceFingerprint } from "@/lib/hooks/useDeviceFingerprint";
import { ADMIN_SESSION_COOKIE, useAdminAuthStore } from "@/lib/store/adminAuthStore";
import { generateUuid } from "@/lib/utils/generateUuid";
import { ROUTES } from "@/lib/constants/routes";
import type { AdminRefreshResponse } from "@/types/admin.types";
import type { ApiSuccess } from "@/types/api.types";
import { toAppError } from "./errors";

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

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

function isRefreshRequest(url?: string): boolean {
  return (url ?? "").includes("/admin/auth/refresh");
}

let refreshInFlight: Promise<boolean> | null = null;

/** Restores the in-memory access token from the persistent HttpOnly refresh cookie. */
export function ensureAdminSession(): Promise<boolean> {
  if (useAdminAuthStore.getState().getValidToken()) return Promise.resolve(true);
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await apiClient.post<ApiSuccess<AdminRefreshResponse>>("/admin/auth/refresh", {});
        const session = response.data.data;
        const email = useAdminAuthStore.getState().email ?? "";
        useAdminAuthStore.getState().setSession({
          email,
          accessToken: session.accessToken,
          expiresIn: session.expiresIn,
        });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function leaveAdminLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith(ROUTES.adminLogin)) return;
  window.location.assign(ROUTES.adminLogin);
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      isAdminRequest(error.config?.url)
    ) {
      const config = error.config as RetryConfig | undefined;
      if (config && !isRefreshRequest(config.url) && !config._retry) {
        config._retry = true;
        const restored = await ensureAdminSession();
        if (restored) {
          const token = useAdminAuthStore.getState().getValidToken();
          if (token) config.headers.set("Authorization", `Bearer ${token}`);
          return apiClient(config);
        }
      }
      const hadSession = Boolean(
        useAdminAuthStore.getState().accessToken ||
        useAdminAuthStore.getState().email ||
        (typeof document !== "undefined" && document.cookie.includes(`${ADMIN_SESSION_COOKIE}=`)),
      );
      useAdminAuthStore.getState().clearSession(hadSession);
      leaveAdminLogin();
    }
    return Promise.reject(toAppError(error));
  },
);
