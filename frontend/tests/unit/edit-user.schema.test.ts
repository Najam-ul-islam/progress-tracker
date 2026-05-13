import { describe, expect, it } from "vitest";
import {
  diffDraft,
  editUserSchema,
  hasChanges,
  userToFormValues,
} from "@/modules/users/schemas/edit-user.schema";
import type { User } from "@/modules/users/types";

const baseUser: User = {
  id: 1,
  name: "Ada Admin",
  email: "ada@example.com",
  role: "admin",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("editUserSchema", () => {
  it("accepts a valid payload", () => {
    const result = editUserSchema.safeParse({
      name: "Maya",
      role: "manager",
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = editUserSchema.safeParse({ name: "   ", role: "manager", isActive: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "name")).toBe(true);
    }
  });

  it("rejects an unknown role", () => {
    const result = editUserSchema.safeParse({
      name: "Maya",
      role: "owner" as never,
      isActive: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires isActive to be boolean", () => {
    const result = editUserSchema.safeParse({
      name: "Maya",
      role: "manager",
      isActive: "yes" as never,
    });
    expect(result.success).toBe(false);
  });
});

describe("userToFormValues", () => {
  it("maps a user to form values", () => {
    expect(userToFormValues(baseUser)).toEqual({
      name: "Ada Admin",
      role: "admin",
      isActive: true,
    });
  });
});

describe("diffDraft + hasChanges", () => {
  it("returns empty draft when nothing changed", () => {
    const draft = diffDraft(baseUser, userToFormValues(baseUser));
    expect(draft).toEqual({});
    expect(hasChanges(draft)).toBe(false);
  });

  it("includes only the changed name (trimmed)", () => {
    const draft = diffDraft(baseUser, { name: "  Ada Updated  ", role: "admin", isActive: true });
    expect(draft).toEqual({ name: "Ada Updated" });
    expect(hasChanges(draft)).toBe(true);
  });

  it("includes only the changed role", () => {
    const draft = diffDraft(baseUser, { name: "Ada Admin", role: "manager", isActive: true });
    expect(draft).toEqual({ role: "manager" });
  });

  it("includes only the changed isActive", () => {
    const draft = diffDraft(baseUser, { name: "Ada Admin", role: "admin", isActive: false });
    expect(draft).toEqual({ isActive: false });
  });

  it("includes multiple changed fields", () => {
    const draft = diffDraft(baseUser, { name: "New Name", role: "manager", isActive: false });
    expect(draft).toEqual({ name: "New Name", role: "manager", isActive: false });
    expect(hasChanges(draft)).toBe(true);
  });
});
