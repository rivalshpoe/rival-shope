import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/lib/utils/safeStorage";

/** Cookie checked by `middleware.ts` + the dashboard layout to gate `/mgmt-portal-x7k9/dashboard/*`. */
export const ADMIN_SESSION_COOKIE = "rival_admin_session";

/** Matches the server refresh-token lifetime so closing the browser does not end the session. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface AdminAuthState {
  email: string | null;
  accessToken: string | null;
  expiresAt: number | null;
  sessionExpired: boolean;
  setSession: (session: { email: string; accessToken?: string; expiresIn?: number }) => void;
  clearSession: (expired?: boolean) => void;
  getValidToken: () => string | null;
}

function writeSessionCookie(maxAgeSeconds: number | null): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (maxAgeSeconds === null) {
    document.cookie = `${ADMIN_SESSION_COOKIE}=; Max-Age=0; path=/; SameSite=Lax${secure}`;
    return;
  }
  // Routing hint only. The credential is the HttpOnly refresh cookie, which survives a closed browser.
  document.cookie = `${ADMIN_SESSION_COOKIE}=1; Max-Age=${Math.max(60, maxAgeSeconds)}; path=/; SameSite=Lax${secure}`;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      email: null,
      accessToken: null,
      expiresAt: null,
      sessionExpired: false,
      setSession: ({ email, accessToken, expiresIn }) => {
        writeSessionCookie(ADMIN_SESSION_MAX_AGE_SECONDS);
        set({
          email,
          accessToken: accessToken ?? null,
          expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
          sessionExpired: false,
        });
      },
      clearSession: (expired = false) => {
        writeSessionCookie(null);
        set({ email: null, accessToken: null, expiresAt: null, sessionExpired: expired });
      },
      getValidToken: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken) return null;
        // An expired access token is refreshed silently. Do not drop the persistent session cookie.
        if (expiresAt !== null && expiresAt <= Date.now() + 15_000) return null;
        return accessToken;
      },
    }),
    {
      name: "rival-admin-session",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // Tokens intentionally remain memory-only; cookie sessions need no JS token.
      partialize: (state) => ({ email: state.email, sessionExpired: state.sessionExpired }),
    },
  ),
);
