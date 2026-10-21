import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../mocks/server";
import { registerEmailInUse, registerSuccess, loginSuccess } from "../mocks/auth-handlers";
import { RegisterPage } from "@/modules/auth/pages/RegisterPage";
import { useSessionStore } from "@/modules/auth/store/session.store";

function renderRegister() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<div>HOME</div>} />
          <Route path="/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/name/i), "Jane Doe");
  await user.type(screen.getByLabelText(/email/i), "jane@example.com");
  await user.type(screen.getByLabelText(/^password$/i), "secret123");
}

describe("RegisterPage", () => {
  beforeEach(() => {
    useSessionStore.getState().clear("user-initiated");
  });

  it("renders all required fields", () => {
    renderRegister();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows client validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderRegister();
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("registers, auto-logs in, and navigates home on success", async () => {
    server.use(registerSuccess({ email: "jane@example.com", name: "Jane Doe" }));
    server.use(loginSuccess({ email: "jane@example.com", name: "Jane Doe" }));
    const user = userEvent.setup();
    renderRegister();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(screen.getByText("HOME")).toBeInTheDocument());
    expect(useSessionStore.getState().user?.email).toBe("jane@example.com");
  });

  it("surfaces email-in-use error on the email field", async () => {
    server.use(registerEmailInUse());
    const user = userEvent.setup();
    renderRegister();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
  });
});
