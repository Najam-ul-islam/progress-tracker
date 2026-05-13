import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import {
  seededUsers,
  userGetNotFound,
  userUpdateConflict,
  userUpdateValidation,
  usersListForbidden,
  usersListUnauthorized,
} from "../mocks/users-handlers";
import { usersApi } from "@/modules/users/services/users.api";
import { UsersApiError } from "@/modules/users/types";

const BASE = "http://localhost:8000";

describe("usersApi.list", () => {
  it("maps wire snake_case to domain camelCase", async () => {
    const users = await usersApi.list();
    expect(users).toHaveLength(seededUsers.length);
    expect(users[0]).toMatchObject({
      id: 1,
      name: "Ada Admin",
      email: "ada@example.com",
      role: "admin",
      isActive: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("throws UsersApiError(forbidden) on 403", async () => {
    server.use(usersListForbidden());
    await expect(usersApi.list()).rejects.toMatchObject({
      name: "UsersApiError",
      code: "forbidden",
      status: 403,
    });
  });

  it("throws UsersApiError(unauthorized) on 401", async () => {
    server.use(usersListUnauthorized());
    await expect(usersApi.list()).rejects.toBeInstanceOf(UsersApiError);
  });
});

describe("usersApi.get", () => {
  it("returns the user when found", async () => {
    const user = await usersApi.get(1);
    expect(user.id).toBe(1);
    expect(user.isActive).toBe(true);
  });

  it("throws not_found on 404", async () => {
    server.use(userGetNotFound());
    await expect(usersApi.get(999)).rejects.toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("usersApi.update", () => {
  it("sends only the changed name field", async () => {
    let captured: unknown;
    server.use(
      http.patch(`${BASE}/users/:id`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({
          id: 1,
          name: "Renamed",
          email: "ada@example.com",
          role: "admin",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        });
      })
    );
    const updated = await usersApi.update(1, { name: "Renamed" });
    expect(captured).toEqual({ name: "Renamed" });
    expect(updated.name).toBe("Renamed");
  });

  it("surfaces validation field errors on 422", async () => {
    server.use(userUpdateValidation({ name: "Name is required" }));
    try {
      await usersApi.update(1, { name: "" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UsersApiError);
      expect((err as UsersApiError).code).toBe("validation");
      expect((err as UsersApiError).fieldErrors).toEqual({ name: "Name is required" });
    }
  });

  it("surfaces conflict detail on 409", async () => {
    server.use(userUpdateConflict("Cannot demote last admin"));
    await expect(usersApi.update(1, { role: "developer" })).rejects.toMatchObject({
      code: "conflict",
      status: 409,
      detail: "Cannot demote last admin",
    });
  });
});

describe("usersApi.updateStatus", () => {
  it("posts is_active=false on deactivation", async () => {
    let captured: unknown;
    server.use(
      http.patch(`${BASE}/users/:id/status`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({
          id: 1,
          name: "Ada Admin",
          email: "ada@example.com",
          role: "admin",
          is_active: false,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        });
      })
    );
    const updated = await usersApi.updateStatus(1, false);
    expect(captured).toEqual({ is_active: false });
    expect(updated.isActive).toBe(false);
  });
});
