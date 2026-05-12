import { SESSION_STORAGE_KEY, sessionStore } from "@/modules/auth/store/session.store";

export function attachCrossTabSync(): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key !== SESSION_STORAGE_KEY) return;
    if (event.newValue === null) {
      sessionStore.getState().clear("user-initiated");
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue) as {
        state?: { accessToken?: string | null };
      };
      if (!parsed?.state?.accessToken) {
        sessionStore.getState().clear("user-initiated");
      }
    } catch {
      sessionStore.getState().clear("user-initiated");
    }
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
