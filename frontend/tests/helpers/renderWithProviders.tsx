import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSessionStore } from "@/modules/auth/store/session.store";
import type { Role, TokenResponse } from "@/modules/auth/types";

type SessionSeed = { id?: number; name?: string; email?: string; role: Role };

export function seedSession(seed: SessionSeed) {
  const futureExp = Math.floor(Date.now() / 1000) + 60 * 60;
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, "");
  const payload = btoa(
    JSON.stringify({
      sub: String(seed.id ?? 1),
      email: seed.email ?? "test@example.com",
      role: seed.role,
      iat: Math.floor(Date.now() / 1000),
      exp: futureExp,
    })
  ).replace(/=+$/, "");
  const token: TokenResponse = {
    accessToken: `${header}.${payload}.sig`,
    tokenType: "bearer",
    user: {
      id: seed.id ?? 1,
      name: seed.name ?? "Test User",
      email: seed.email ?? "test@example.com",
      role: seed.role,
    },
  };
  useSessionStore.getState().setSession(token);
}

export function clearSession() {
  useSessionStore.getState().clear("user-initiated");
}

type RenderOptions = {
  initialEntries?: string[];
  extraRoutes?: ReactElement;
};

export function renderRoute(
  path: string,
  element: ReactElement,
  opts: RenderOptions = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={opts.initialEntries ?? [path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/" element={<div>HOME</div>} />
          <Route path="/login" element={<div>LOGIN</div>} />
          <Route path="/users" element={<div>USERS_LIST</div>} />
          <Route path="/users/:id" element={<div>USER_PROFILE</div>} />
          {opts.extraRoutes}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
