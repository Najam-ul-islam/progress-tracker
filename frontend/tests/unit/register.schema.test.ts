import { describe, expect, it } from "vitest";
import { registerSchema } from "@/modules/auth/schemas/register.schema";

describe("registerSchema", () => {
  it("accepts a valid payload", () => {
    const r = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "abcdefg1",
      role: "developer",
    });
    expect(r.success).toBe(true);
  });

  it("rejects short password", () => {
    const r = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "abc1",
      role: "developer",
    });
    expect(r.success).toBe(false);
  });

  it("rejects password without a digit", () => {
    const r = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "abcdefgh",
      role: "developer",
    });
    expect(r.success).toBe(false);
  });

  it("rejects password without a letter", () => {
    const r = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "12345678",
      role: "developer",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown role", () => {
    const r = registerSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "abcdefg1",
      role: "owner",
    });
    expect(r.success).toBe(false);
  });

  it("requires non-empty name", () => {
    const r = registerSchema.safeParse({
      name: "  ",
      email: "jane@example.com",
      password: "abcdefg1",
      role: "developer",
    });
    expect(r.success).toBe(false);
  });
});
