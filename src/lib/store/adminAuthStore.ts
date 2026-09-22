import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/lib/utils/safeStorage";

/** Cookie checked by `middleware.ts` + the dashboard layout to gate `/mgmt-portal-x7k9/dashboard/*`. */
export const ADMIN_SESSION_COOKIE = "rival_admin_session";

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
    document.cookie = `${ADMIN_SESSION_COOKIE}=; Max-Age=0; path=/; SameSite=Strict${secure}`;
    return;
  }
  // The cookie is a routing hint only — the real credential is the Bearer token
  // (memory) + the HttpOnly refresh cookie set by the API.
  document.cookie = `${ADMIN_SESSION_COOKIE}=1; Max-Age=${Math.max(60, maxAgeSeconds)}; path=/; SameSite=Strict${secure}`;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      email: null,
      accessToken: null,
      expiresAt: null,
      sessionExpired: false,
      setSession: ({ email, accessToken, expiresIn }) => {
        writeSessionCookie(expiresIn ?? 60 * 60 * 12);
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
        if (expiresAt !== null && expiresAt <= Date.now()) {
          get().clearSession(true);
          return null;
        }
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
