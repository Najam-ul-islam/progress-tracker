import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { server } from "../mocks/server";
import {
  clientGetSuccess,
  clientGetNotFound,
  seededClients,
} from "../mocks/clients-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { ClientDetailsPage } from "@/modules/clients/pages/ClientDetailsPage";

afterEach(() => clearSession());

function renderDetails(id: number) {
  return renderRoute("/clients/:id", <ClientDetailsPage />, {
    initialEntries: [`/clients/${id}`],
  });
}

describe("ClientDetailsPage", () => {
  it("renders contact-info cards for an admin", async () => {
    server.use(clientGetSuccess(seededClients[0]));
    seedSession({ role: "admin", id: 1 });
    renderDetails(1);
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
    expect(screen.getByText("contact@acme.example.com")).toBeInTheDocument();
    expect(screen.getByText("+1 415 555 0101")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^identity$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^contact$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^notes$/i })).toBeInTheDocument();
  });

  it("renders the same view for a manager (deep link)", async () => {
    server.use(clientGetSuccess(seededClients[0]));
    seedSession({ role: "manager", id: 2 });
    renderDetails(1);
    expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
  });

  it("shows 'Not provided' for empty optional fields", async () => {
    server.use(clientGetSuccess(seededClients[1])); // Beth: null company/address/notes
    seedSession({ role: "admin", id: 1 });
    renderDetails(2);
    await screen.findByText("Beth Boran");
    expect(screen.getAllByText(/not provided/i).length).toBeGreaterThanOrEqual(3);
  });

  it("denies access to a developer", async () => {
    seedSession({ role: "developer", id: 3 });
    renderDetails(1);
    expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("shows 'Client not found' for an unknown id", async () => {
    server.use(clientGetNotFound());
    seedSession({ role: "admin", id: 1 });
    renderDetails(999);
    expect(await screen.findByText(/client not found/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to clients/i })).toBeInTheDocument();
  });

  it("shows a loading skeleton while fetching", async () => {
    server.use(clientGetSuccess(seededClients[0]));
    seedSession({ role: "admin", id: 1 });
    renderDetails(1);
    expect(screen.getByTestId("client-details-skeleton")).toBeInTheDocument();
    await screen.findByText("Acme Corp");
  });
});
