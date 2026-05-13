import { SESSION_STORAGE_KEY, sessionStore } from "@/modules/auth/store/session.store";
import type { TokenResponse, User } from "@/modules/auth/types";

export function attachCrossTabSync(): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key !== SESSION_STORAGE_KEY) return;
    if (event.newValue === null) {
      sessionStore.getState().clear("user-initiated");
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue) as {
        state?: { accessToken?: string | null; user?: User | null };
      };
      const nextToken = parsed?.state?.accessToken ?? null;
      const nextUser = parsed?.state?.user ?? null;
      if (!nextToken || !nextUser) {
        sessionStore.getState().clear("user-initiated");
        return;
      }
      const current = sessionStore.getState();
      if (current.accessToken === nextToken && current.user?.role === nextUser.role) return;
      const token: TokenResponse = {
        accessToken: nextToken,
        tokenType: "bearer",
        user: nextUser,
      };
      sessionStore.getState().setSession(token);
    } catch {
      sessionStore.getState().clear("user-initiated");
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
