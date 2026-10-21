import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLogout } from "@/modules/auth/hooks/useLogout";
import { useSessionStore } from "@/modules/auth/store/session.store";

function SignOutButton() {
  const logout = useLogout();
  return (
    <button type="button" onClick={logout}>
      Sign out
    </button>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<SignOutButton />} />
          <Route path="/login" element={<div>LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("useLogout", () => {
  beforeEach(() => {
    localStorage.clear();
    useSessionStore.getState().setSession({
      accessToken: "tok",
      tokenType: "bearer",
      user: { id: 1, name: "T", email: "t@example.com", role: "developer" },
    });
  });

  it("clears the session and navigates to /login on click", async () => {
    const user = userEvent.setup();
    renderHarness();
    expect(useSessionStore.getState().accessToken).toBe("tok");
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(screen.getByText("LOGIN")).toBeInTheDocument());
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(useSessionStore.getState().lastClearReason).toBe("user-initiated");
  });
});
