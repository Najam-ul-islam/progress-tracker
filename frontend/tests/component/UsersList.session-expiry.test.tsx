import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../mocks/server";
import { usersListUnauthorized } from "../mocks/users-handlers";
import { clearSession, seedSession } from "../helpers/renderWithProviders";
import { RequireAuth } from "@/modules/auth/components/RequireAuth";
import { UsersListPage } from "@/modules/users/pages/UsersListPage";

afterEach(() => clearSession());

function LoginProbe() {
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  return <div>LOGIN from={state?.from ?? ""}</div>;
}

describe("Users list session expiry", () => {
  it("redirects to /login with from=/users when 401 occurs mid-page", async () => {
    server.use(usersListUnauthorized());
    seedSession({ role: "admin", id: 1 });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/users"]}>
          <Routes>
            <Route path="/login" element={<LoginProbe />} />
            <Route element={<RequireAuth />}>
              <Route path="/users" element={<UsersListPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/LOGIN from=\/users/)).toBeInTheDocument();
    });
  });
});
