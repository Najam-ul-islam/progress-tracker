import { describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import {
  seededClients,
  clientsListForbidden,
  clientsListNetworkError,
  clientGetNotFound,
  clientCreateConflict,
  clientCreateValidation,
} from "../mocks/clients-handlers";
import { clientsApi, toCreateBody } from "@/modules/clients/services/clients.api";
import { ClientsApiError } from "@/modules/clients/types";

describe("clients.api wire mapping", () => {
  it("maps snake_case wire fields to camelCase domain fields", async () => {
    const clients = await clientsApi.list();
    const acme = clients[0];
    expect(acme.companyName).toBe("Acme Corporation");
    expect(acme.isActive).toBe(true);
    expect(acme.createdAt).toBe("2026-02-01T00:00:00Z");
    expect(acme.updatedAt).toBe("2026-02-01T00:00:00Z");
  });

  it("preserves null optionals", async () => {
    const clients = await clientsApi.list();
    const beth = clients.find((c) => c.id === 2)!;
    expect(beth.companyName).toBeNull();
    expect(beth.address).toBeNull();
    expect(beth.notes).toBeNull();
  });

  it("get maps a single client", async () => {
    const client = await clientsApi.get(seededClients[0].id);
    expect(client.name).toBe("Acme Corp");
    expect(client.phone).toBe("+1 415 555 0101");
  });
});

describe("toCreateBody", () => {
  it("includes the required trio and omits empty optionals", () => {
    const body = toCreateBody({
      name: "  New Co  ",
      email: " new@co.example.com ",
      phone: "+1 555 555 0100",
      companyName: "",
      address: "  ",
      notes: "",
    });
    expect(body).toEqual({
      name: "New Co",
      email: "new@co.example.com",
      phone: "+1 555 555 0100",
    });
    expect("company_name" in body).toBe(false);
    expect("address" in body).toBe(false);
    expect("notes" in body).toBe(false);
  });

  it("includes optionals when present", () => {
    const body = toCreateBody({
      name: "Co",
      email: "c@co.example.com",
      phone: "+1 555 555 0100",
      companyName: "Co Ltd",
      address: "1 St",
      notes: "vip",
    });
    expect(body.company_name).toBe("Co Ltd");
    expect(body.address).toBe("1 St");
    expect(body.notes).toBe("vip");
  });
});

describe("clients.api error mapping", () => {
  it("maps 403 to forbidden", async () => {
    server.use(clientsListForbidden());
    await expect(clientsApi.list()).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("maps network failure to network", async () => {
    server.use(clientsListNetworkError());
    await expect(clientsApi.list()).rejects.toMatchObject({ code: "network" });
  });

  it("maps 404 to not_found", async () => {
    server.use(clientGetNotFound());
    await expect(clientsApi.get(999)).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("maps 409 to conflict and carries the detail message", async () => {
    server.use(clientCreateConflict("phone"));
    try {
      await clientsApi.create({ name: "X", email: "x@x.example.com", phone: "+1 555 555 0100" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ClientsApiError);
      expect((err as ClientsApiError).code).toBe("conflict");
      expect((err as ClientsApiError).detail).toMatch(/phone/i);
    }
  });

  it("maps 422 to validation with field errors", async () => {
    server.use(clientCreateValidation({ email: "value is not a valid email address" }));
    try {
      await clientsApi.create({ name: "X", email: "bad", phone: "+1 555 555 0100" });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as ClientsApiError).code).toBe("validation");
      expect((err as ClientsApiError).fieldErrors?.email).toMatch(/valid email/i);
    }
  });
});
