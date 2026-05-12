import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ClearReason, Role, TokenResponse, User } from "@/modules/auth/types";

export const SESSION_STORAGE_KEY = "progress-tracker.session";

type Persisted = {
  accessToken: string | null;
  user: User | null;
  expiresAt: string | null;
};

type Transient = {
  hydrated: boolean;
  lastClearReason: ClearReason | null;
};

type Actions = {
  setSession(tr: TokenResponse): void;
  clear(reason?: ClearReason): void;
  isExpired(now?: Date): boolean;
};

export type SessionState = Persisted & Transient & Actions;

function decodeJwtExp(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (typeof payload.exp !== "number") return null;
    return new Date(payload.exp * 1000).toISOString();
  } catch {
    return null;
  }
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      expiresAt: null,
      hydrated: false,
      lastClearReason: null,

      setSession(tr) {
        set({
          accessToken: tr.accessToken,
          user: tr.user,
          expiresAt: decodeJwtExp(tr.accessToken),
          lastClearReason: null,
        });
      },

      clear(reason = "user-initiated") {
        set({
          accessToken: null,
          user: null,
          expiresAt: null,
          lastClearReason: reason,
        });
      },

      isExpired(now = new Date()) {
        const exp = get().expiresAt;
        if (!exp) return false;
        return new Date(exp).getTime() <= now.getTime();
      },
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Persisted => ({
        accessToken: s.accessToken,
        user: s.user,
        expiresAt: s.expiresAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);

export const sessionStore = useSessionStore;

export const selectIsAuthenticated = (s: SessionState): boolean =>
  s.accessToken !== null && !s.isExpired();

export const selectRole = (s: SessionState): Role | null => s.user?.role ?? null;

export const selectCanAccess = (s: SessionState, allowed: readonly Role[]): boolean => {
  const role = selectRole(s);
  return role !== null && allowed.includes(role);
};
