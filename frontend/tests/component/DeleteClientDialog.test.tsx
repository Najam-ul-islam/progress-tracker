import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import { clientDeleteSuccess, clientDeleteNetworkError } from "../mocks/clients-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { DeleteClientDialog } from "@/modules/clients/components/DeleteClientDialog";
import type { Client } from "@/modules/clients/types";

afterEach(() => clearSession());

const target: Client = {
  id: 1,
  name: "Acme Corp",
  email: "contact@acme.example.com",
  phone: "+1 415 555 0101",
  companyName: "Acme Corporation",
  address: "1 Market St",
  notes: "Flagship",
  isActive: true,
  createdAt: "2026-02-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
};

describe("DeleteClientDialog", () => {
  it("renders nothing for a manager (admin-only)", () => {
    seedSession({ role: "manager", id: 2 });
    const { container } = renderRoute(
      "/x",
      <DeleteClientDialog client={target} open onOpenChange={() => {}} />
    );
    expect(container.textContent ?? "").not.toMatch(/delete client/i);
  });

  it("renders nothing for a developer", () => {
    seedSession({ role: "developer", id: 3 });
    const { container } = renderRoute(
      "/x",
      <DeleteClientDialog client={target} open onOpenChange={() => {}} />
    );
    expect(container.textContent ?? "").not.toMatch(/delete client/i);
  });

  it("names the client in the confirmation for an admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <DeleteClientDialog client={target} open onOpenChange={() => {}} />);
    expect(await screen.findByText(/delete client/i)).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("confirms deletion and calls onDeleted, then closes", async () => {
    server.use(clientDeleteSuccess());
    seedSession({ role: "admin", id: 1 });
    const onOpenChange = vi.fn();
    const onDeleted = vi.fn();
    renderRoute(
      "/x",
      <DeleteClientDialog client={target} open onOpenChange={onOpenChange} onDeleted={onDeleted} />
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not delete on cancel", async () => {
    seedSession({ role: "admin", id: 1 });
    const onOpenChange = vi.fn();
    const onDeleted = vi.fn();
    renderRoute(
      "/x",
      <DeleteClientDialog client={target} open onOpenChange={onOpenChange} onDeleted={onDeleted} />
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows a retry-able error and does not delete on network failure", async () => {
    server.use(clientDeleteNetworkError());
    seedSession({ role: "admin", id: 1 });
    const onDeleted = vi.fn();
    renderRoute(
      "/x",
      <DeleteClientDialog client={target} open onOpenChange={() => {}} onDeleted={onDeleted} />
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^delete$/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
