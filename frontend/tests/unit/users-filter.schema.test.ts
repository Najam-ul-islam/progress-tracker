import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTER,
  filterToParams,
  parseFilter,
  usersFilterSchema,
} from "@/modules/users/schemas/users-filter.schema";

describe("usersFilterSchema", () => {
  it("accepts empty defaults", () => {
    expect(usersFilterSchema.parse({})).toEqual(DEFAULT_FILTER);
  });

  it("accepts valid combinations", () => {
    expect(usersFilterSchema.parse({ q: "ada", role: "manager", status: "active" })).toEqual({
      q: "ada",
      role: "manager",
      status: "active",
    });
  });

  it("rejects unknown role", () => {
    expect(usersFilterSchema.safeParse({ role: "owner" }).success).toBe(false);
  });
});

describe("parseFilter", () => {
  it("falls back to defaults when params are missing", () => {
    expect(parseFilter(new URLSearchParams())).toEqual(DEFAULT_FILTER);
  });

  it("reads valid params", () => {
    const params = new URLSearchParams({ q: "ada", role: "admin", status: "inactive" });
    expect(parseFilter(params)).toEqual({ q: "ada", role: "admin", status: "inactive" });
  });

  it("falls back to defaults when params are invalid", () => {
    const params = new URLSearchParams({ role: "owner" });
    expect(parseFilter(params)).toEqual(DEFAULT_FILTER);
  });
});

describe("filterToParams", () => {
  it("omits default values", () => {
    expect(filterToParams(DEFAULT_FILTER)).toEqual({});
  });

  it("emits non-default values", () => {
    expect(filterToParams({ q: "ada", role: "manager", status: "active" })).toEqual({
      q: "ada",
      role: "manager",
      status: "active",
    });
  });
});
