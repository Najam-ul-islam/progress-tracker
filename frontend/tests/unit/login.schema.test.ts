import { describe, expect, it } from "vitest";
import { loginSchema } from "@/modules/auth/schemas/login.schema";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    const r = loginSchema.safeParse({ email: "user@example.com", password: "secret" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "email")).toBe(true);
    }
  });

  it("rejects empty password", () => {
    const r = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "password")).toBe(true);
    }
  });

  it("lowercases and trims email", () => {
    const r = loginSchema.safeParse({ email: "  USER@Example.com  ", password: "x" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("user@example.com");
    }
  });
});
