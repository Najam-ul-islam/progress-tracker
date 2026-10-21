import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, "");
  return `${header}.${body}.fake-signature`;
}

const futureExp = () => Math.floor(Date.now() / 1000) + 60 * 60;

export const loginSuccess = (overrides?: { email?: string; role?: string; name?: string }) =>
  http.post(`${BASE}/auth/login`, async () => {
    const user = {
      id: 1,
      name: overrides?.name ?? "Test User",
      email: overrides?.email ?? "test@example.com",
      role: overrides?.role ?? "developer",
    };
    return HttpResponse.json({
      access_token: makeJwt({
        sub: String(user.id),
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: futureExp(),
      }),
      token_type: "bearer",
      user,
    });
  });

export const loginInvalid = () =>
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ detail: "Could not validate credentials" }, { status: 401 })
  );

export const loginValidationError = () =>
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json(
      {
        detail: [
          { loc: ["body", "email"], msg: "value is not a valid email", type: "value_error.email" },
        ],
      },
      { status: 422 }
    )
  );

export const registerSuccess = (overrides?: { email?: string; role?: string; name?: string }) =>
  http.post(`${BASE}/auth/register`, async () => {
    return HttpResponse.json(
      {
        id: 1,
        name: overrides?.name ?? "Test User",
        email: overrides?.email ?? "new@example.com",
        role: overrides?.role ?? "developer",
        created_at: new Date().toISOString(),
      },
      { status: 201 }
    );
  });

export const registerEmailInUse = () =>
  http.post(`${BASE}/auth/register`, () =>
    HttpResponse.json({ detail: "Email already registered" }, { status: 409 })
  );

export const registerValidationError = () =>
  http.post(`${BASE}/auth/register`, () =>
    HttpResponse.json(
      {
        detail: [
          { loc: ["body", "password"], msg: "ensure this value has at least 8 characters", type: "value_error" },
        ],
      },
      { status: 422 }
    )
  );

export const meSuccess = (overrides?: { id?: number; email?: string; role?: string; name?: string }) =>
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({
      id: overrides?.id ?? 1,
      name: overrides?.name ?? "Test User",
      email: overrides?.email ?? "test@example.com",
      role: overrides?.role ?? "developer",
    })
  );

export const meUnauthorized = () =>
  http.get(`${BASE}/auth/me`, () =>
    HttpResponse.json({ detail: "Could not validate credentials" }, { status: 401 })
  );

export const defaultHandlers = [loginSuccess(), registerSuccess(), meSuccess()];
