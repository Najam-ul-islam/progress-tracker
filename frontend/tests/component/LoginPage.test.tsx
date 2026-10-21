import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../mocks/server";
import { loginInvalid, loginSuccess } from "../mocks/auth-handlers";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { useSessionStore } from "@/modules/auth/store/session.store";

function renderLogin(initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/login"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>HOME</div>} />
          <Route path="/projects" element={<div>PROJECTS</div>} />
          <Route path="/register" element={<div>REGISTER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    useSessionStore.getState().clear("user-initiated");
  });

  it("renders email + password fields and submit button", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows client validation errors when fields are empty", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it("submits and navigates to / on success", async () => {
    server.use(loginSuccess());
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText("HOME")).toBeInTheDocument());
    expect(useSessionStore.getState().accessToken).toBeTypeOf("string");
  });

  it("redirects to the original `from` location after success", async () => {
    server.use(loginSuccess());
    const user = userEvent.setup();
    renderLogin([{ pathname: "/login", state: { from: "/projects" } }]);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText("PROJECTS")).toBeInTheDocument());
  });

  it("shows a generic alert and clears password on invalid credentials", async () => {
    server.use(loginInvalid());
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    const pw = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    await user.type(pw, "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(pw.value).toBe("");
  });

  it("surfaces a session-ended reason if passed via location.state", () => {
    renderLogin([{ pathname: "/login", state: { reason: "session-ended" } }]);
    expect(screen.getByRole("alert")).toHaveTextContent(/session ended/i);
  });
});
