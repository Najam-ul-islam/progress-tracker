import { beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_STORAGE_KEY,
  selectCanAccess,
  selectIsAuthenticated,
  selectRole,
  useSessionStore,
} from "@/modules/auth/store/session.store";
import type { TokenResponse } from "@/modules/auth/types";

function makeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, "");
  const body = btoa(JSON.stringify({ sub: "1", exp })).replace(/=+$/, "");
  return `${header}.${body}.fake`;
}

function tokenResponse(opts: { exp?: number; role?: "admin" | "manager" | "developer" } = {}): TokenResponse {
  const exp = opts.exp ?? Math.floor(Date.now() / 1000) + 3600;
  return {
    accessToken: makeJwt(exp),
    tokenType: "bearer",
    user: {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      role: opts.role ?? "developer",
    },
  };
}

describe("session.store", () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.getState().clear("user-initiated");
  });

  it("setSession stores token, user, and computes expiresAt from JWT", () => {
    const tr = tokenResponse();
    useSessionStore.getState().setSession(tr);
    const s = useSessionStore.getState();
    expect(s.accessToken).toBe(tr.accessToken);
    expect(s.user?.email).toBe("test@example.com");
    expect(s.expiresAt).not.toBeNull();
    expect(s.lastClearReason).toBeNull();
  });

  it("clear wipes session and records the reason", () => {
    useSessionStore.getState().setSession(tokenResponse());
    useSessionStore.getState().clear("session-ended");
    const s = useSessionStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.expiresAt).toBeNull();
    expect(s.lastClearReason).toBe("session-ended");
  });

  it("isExpired returns true for past exp", () => {
    useSessionStore.getState().setSession(tokenResponse({ exp: Math.floor(Date.now() / 1000) - 10 }));
    expect(useSessionStore.getState().isExpired()).toBe(true);
  });

  it("selectIsAuthenticated reflects valid token", () => {
    expect(selectIsAuthenticated(useSessionStore.getState())).toBe(false);
    useSessionStore.getState().setSession(tokenResponse());
    expect(selectIsAuthenticated(useSessionStore.getState())).toBe(true);
  });

  it("selectRole and selectCanAccess respect role membership", () => {
    useSessionStore.getState().setSession(tokenResponse({ role: "manager" }));
    expect(selectRole(useSessionStore.getState())).toBe("manager");
    expect(selectCanAccess(useSessionStore.getState(), ["manager", "admin"])).toBe(true);
    expect(selectCanAccess(useSessionStore.getState(), ["admin"])).toBe(false);
  });

  it("persists slice to localStorage under the expected key", () => {
    useSessionStore.getState().setSession(tokenResponse());
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.accessToken).toBeTypeOf("string");
    expect(parsed.state.user.email).toBe("test@example.com");
  });
});
