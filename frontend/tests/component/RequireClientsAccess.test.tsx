import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { RequireClientsAccess } from "@/modules/clients/components/RequireClientsAccess";

afterEach(() => clearSession());

function Protected() {
  return (
    <RequireClientsAccess>
      <div>CLIENTS_CONTENT</div>
    </RequireClientsAccess>
  );
}

describe("RequireClientsAccess", () => {
  it("renders children for admin", () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <Protected />);
    expect(screen.getByText("CLIENTS_CONTENT")).toBeInTheDocument();
  });

  it("renders children for manager", () => {
    seedSession({ role: "manager", id: 2 });
    renderRoute("/x", <Protected />);
    expect(screen.getByText("CLIENTS_CONTENT")).toBeInTheDocument();
  });

  it("blocks a developer with an access-denied state", () => {
    seedSession({ role: "developer", id: 3 });
    renderRoute("/x", <Protected />);
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByText("CLIENTS_CONTENT")).not.toBeInTheDocument();
  });
});
