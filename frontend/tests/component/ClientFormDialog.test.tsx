import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  clientCreateSuccess,
  clientCreateConflict,
  clientCreateNetworkError,
  clientUpdateSuccess,
  clientUpdateConflict,
  seededClients,
} from "../mocks/clients-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { ClientFormDialog } from "@/modules/clients/components/ClientFormDialog";
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

function fillCreate(user: ReturnType<typeof userEvent.setup>) {
  return (async () => {
    await user.type(screen.getByLabelText(/^name$/i), "New Co");
    await user.type(screen.getByLabelText(/^email$/i), "new@co.example.com");
    await user.type(screen.getByLabelText(/^phone$/i), "+1 555 555 0100");
  })();
}

describe("ClientFormDialog — create mode", () => {
  it("renders nothing for a developer", () => {
    seedSession({ role: "developer", id: 3 });
    const { container } = renderRoute(
      "/x",
      <ClientFormDialog mode="create" open onOpenChange={() => {}} />
    );
    expect(container.textContent ?? "").not.toMatch(/new client/i);
  });

  it("creates a client with valid values and closes", async () => {
    server.use(clientCreateSuccess());
    seedSession({ role: "admin", id: 1 });
    let open = true;
    renderRoute("/x", <ClientFormDialog mode="create" open onOpenChange={(o) => (open = o)} />);
    const user = userEvent.setup();
    await screen.findByLabelText(/^name$/i);
    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(open).toBe(false));
  });

  it("blocks submit on a bad email and sends no request", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <ClientFormDialog mode="create" open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "New Co");
    await user.type(screen.getByLabelText(/^email$/i), "bad-email");
    await user.type(screen.getByLabelText(/^phone$/i), "+1 555 555 0100");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  it("blocks submit on a bad phone format", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <ClientFormDialog mode="create" open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^name$/i), "New Co");
    await user.type(screen.getByLabelText(/^email$/i), "new@co.example.com");
    await user.type(screen.getByLabelText(/^phone$/i), "5550100");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/phone must be international format/i)).toBeInTheDocument();
  });

  it("surfaces a 409 email conflict on the email field and stays open", async () => {
    server.use(clientCreateConflict("email"));
    seedSession({ role: "manager", id: 2 });
    let open = true;
    renderRoute("/x", <ClientFormDialog mode="create" open onOpenChange={(o) => (open = o)} />);
    const user = userEvent.setup();
    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/client with this email already exists/i)).toBeInTheDocument();
    expect(open).toBe(true);
  });

  it("preserves values and shows a retry-able error on network failure", async () => {
    server.use(clientCreateNetworkError());
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <ClientFormDialog mode="create" open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("New Co");
  });
});

describe("ClientFormDialog — edit mode", () => {
  it("pre-fills the current values for a manager", async () => {
    seedSession({ role: "manager", id: 2 });
    renderRoute("/x", <ClientFormDialog mode="edit" client={target} open onOpenChange={() => {}} />);
    expect(await screen.findByLabelText(/^name$/i)).toHaveValue("Acme Corp");
    expect(screen.getByLabelText(/^email$/i)).toHaveValue("contact@acme.example.com");
    expect(screen.getByLabelText(/company name/i)).toHaveValue("Acme Corporation");
  });

  it("saves only a changed field and closes", async () => {
    server.use(clientUpdateSuccess(seededClients[0]));
    seedSession({ role: "admin", id: 1 });
    let open = true;
    renderRoute(
      "/x",
      <ClientFormDialog mode="edit" client={target} open onOpenChange={(o) => (open = o)} />
    );
    const user = userEvent.setup();
    const company = await screen.findByLabelText(/company name/i);
    await user.clear(company);
    await user.type(company, "Acme Holdings");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(open).toBe(false));
  });

  it("blocks submit when a required name is cleared", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <ClientFormDialog mode="edit" client={target} open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    const name = await screen.findByLabelText(/^name$/i);
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("closes without a request when nothing changed (no-op)", async () => {
    seedSession({ role: "admin", id: 1 });
    let open = true;
    renderRoute(
      "/x",
      <ClientFormDialog mode="edit" client={target} open onOpenChange={(o) => (open = o)} />
    );
    const user = userEvent.setup();
    await screen.findByLabelText(/^name$/i);
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(open).toBe(false));
  });

  it("surfaces a 409 phone conflict on the phone field and stays open", async () => {
    server.use(clientUpdateConflict("phone"));
    seedSession({ role: "admin", id: 1 });
    let open = true;
    renderRoute(
      "/x",
      <ClientFormDialog mode="edit" client={target} open onOpenChange={(o) => (open = o)} />
    );
    const user = userEvent.setup();
    const phone = await screen.findByLabelText(/^phone$/i);
    await user.clear(phone);
    await user.type(phone, "+1 212 555 9999");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/client with this phone already exists/i)).toBeInTheDocument();
    expect(open).toBe(true);
  });
});
