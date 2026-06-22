import { describe, expect, it } from "vitest";
import {
  parseFilter,
  filterToParams,
  DEFAULT_FILTER,
} from "@/modules/clients/schemas/clients-filter.schema";

describe("clients-filter schema", () => {
  it("parses an empty query string to the default filter", () => {
    expect(parseFilter(new URLSearchParams(""))).toEqual(DEFAULT_FILTER);
  });

  it("parses ?q= into the filter", () => {
    expect(parseFilter(new URLSearchParams("q=acme"))).toEqual({ q: "acme" });
  });

  it("serializes a non-empty query to params", () => {
    expect(filterToParams({ q: "acme" })).toEqual({ q: "acme" });
  });

  it("omits an empty query from params", () => {
    expect(filterToParams({ q: "" })).toEqual({});
  });

  it("round-trips q through params", () => {
    const params = new URLSearchParams(filterToParams({ q: "globex" }));
    expect(parseFilter(params)).toEqual({ q: "globex" });
  });
});
