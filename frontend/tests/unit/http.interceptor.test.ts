import { beforeEach, describe, expect, it } from "vitest";
import { http as mswHttp, HttpResponse } from "msw";
import { server } from "../mocks/server";
import { http } from "@/lib/http";
import { useSessionStore } from "@/modules/auth/store/session.store";

const BASE = "http://localhost:8000";

function setAuthed() {
  useSessionStore.getState().setSession({
    accessToken: "test-token",
    tokenType: "bearer",
    user: { id: 1, name: "T", email: "t@example.com", role: "developer" },
  });
}

describe("http interceptors", () => {
  beforeEach(() => {
    useSessionStore.getState().clear("user-initiated");
  });

  it("attaches Bearer token to outgoing requests when authed", async () => {
    setAuthed();
    let receivedAuth: string | null = null;
    server.use(
      mswHttp.get(`${BASE}/ping`, ({ request }) => {
        receivedAuth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      })
    );
    await http.get("/ping");
    expect(receivedAuth).toBe("Bearer test-token");
  });

  it("clears session on 401 for non-auth endpoints", async () => {
    setAuthed();
    server.use(
      mswHttp.get(`${BASE}/protected`, () =>
        HttpResponse.json({ detail: "nope" }, { status: 401 })
      )
    );
    await expect(http.get("/protected")).rejects.toBeDefined();
    const s = useSessionStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.lastClearReason).toBe("session-ended");
  });

  it("does NOT clear session on 401 from /auth/login", async () => {
    setAuthed();
    server.use(
      mswHttp.post(`${BASE}/auth/login`, () =>
        HttpResponse.json({ detail: "bad creds" }, { status: 401 })
      )
    );
    await expect(http.post("/auth/login", {})).rejects.toBeDefined();
    expect(useSessionStore.getState().accessToken).toBe("test-token");
  });

  it("does NOT clear session on 401 from /auth/register", async () => {
    setAuthed();
    server.use(
      mswHttp.post(`${BASE}/auth/register`, () =>
        HttpResponse.json({ detail: "x" }, { status: 401 })
      )
    );
    await expect(http.post("/auth/register", {})).rejects.toBeDefined();
    expect(useSessionStore.getState().accessToken).toBe("test-token");
  });
});
