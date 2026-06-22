import { describe, expect, it } from "vitest";
import { filterClients } from "@/modules/clients/hooks/useFilteredClients";
import type { Client } from "@/modules/clients/types";

const clients: Client[] = [
  {
    id: 1,
    name: "Acme Corp",
    email: "contact@acme.example.com",
    phone: "+1 415 555 0101",
    companyName: "Acme Corporation",
    address: null,
    notes: null,
    isActive: true,
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-02-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Beth Boran",
    email: "beth@boran.example.com",
    phone: "+44 20 7946 0102",
    companyName: null,
    address: null,
    notes: null,
    isActive: true,
    createdAt: "2026-02-02T00:00:00Z",
    updatedAt: "2026-02-02T00:00:00Z",
  },
];

describe("filterClients", () => {
  it("returns all clients for an empty query", () => {
    expect(filterClients(clients, { q: "" })).toHaveLength(2);
    expect(filterClients(clients, { q: "   " })).toHaveLength(2);
  });

  it("matches on name (case-insensitive)", () => {
    expect(filterClients(clients, { q: "acme" }).map((c) => c.id)).toEqual([1]);
    expect(filterClients(clients, { q: "BETH" }).map((c) => c.id)).toEqual([2]);
  });

  it("matches on company name", () => {
    expect(filterClients(clients, { q: "corporation" }).map((c) => c.id)).toEqual([1]);
  });

  it("matches on email", () => {
    expect(filterClients(clients, { q: "boran.example" }).map((c) => c.id)).toEqual([2]);
  });

  it("matches on phone", () => {
    expect(filterClients(clients, { q: "7946" }).map((c) => c.id)).toEqual([2]);
  });

  it("returns empty when nothing matches", () => {
    expect(filterClients(clients, { q: "zzz" })).toHaveLength(0);
  });

  it("does not throw on a null company name", () => {
    expect(() => filterClients(clients, { q: "beth" })).not.toThrow();
  });
});
