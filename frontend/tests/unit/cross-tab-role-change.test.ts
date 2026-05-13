import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachCrossTabSync } from "@/modules/auth/store/cross-tab";
import { SESSION_STORAGE_KEY, sessionStore } from "@/modules/auth/store/session.store";

function makeToken(role: "admin" | "manager" | "developer"): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, "");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ sub: "1", role, exp })).replace(/=+$/, "");
  return `${header}.${payload}.sig`;
}

let detach: (() => void) | null = null;

beforeEach(() => {
  sessionStore.getState().setSession({
    accessToken: makeToken("admin"),
    tokenType: "bearer",
    user: { id: 1, name: "Ada", email: "ada@example.com", role: "admin" },
  });
  detach = attachCrossTabSync();
});

afterEach(() => {
  detach?.();
  detach = null;
  sessionStore.getState().clear("user-initiated");
});

describe("cross-tab role change", () => {
  it("syncs role change from another tab without reload", () => {
    const newToken = makeToken("developer");
    const persisted = JSON.stringify({
      state: {
        accessToken: newToken,
        user: { id: 1, name: "Ada", email: "ada@example.com", role: "developer" },
        expiresAt: null,
      },
    });
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SESSION_STORAGE_KEY,
        newValue: persisted,
      })
    );
    const state = sessionStore.getState();
    expect(state.user?.role).toBe("developer");
    expect(state.accessToken).toBe(newToken);
  });

  it("clears the session when another tab signs out", () => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SESSION_STORAGE_KEY,
        newValue: null,
      })
    );
    expect(sessionStore.getState().accessToken).toBe(null);
    expect(sessionStore.getState().user).toBe(null);
  });
});
