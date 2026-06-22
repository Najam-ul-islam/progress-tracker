import { describe, expect, it } from "vitest";
import {
  parseFilter,
  filterToParams,
  hasDateRangeError,
  DEFAULT_FILTER,
} from "@/modules/reporting/schemas/analytics-filter.schema";

describe("analytics-filter.schema", () => {
  it("parses a full set of params", () => {
    const params = new URLSearchParams({
      date_from: "2026-01-01",
      date_to: "2026-03-31",
      project_status: "active",
      client_id: "42",
      developer_id: "7",
    });
    expect(parseFilter(params)).toEqual({
      date_from: "2026-01-01",
      date_to: "2026-03-31",
      project_status: "active",
      client_id: 42,
      developer_id: 7,
    });
  });

  it("returns defaults for empty params", () => {
    expect(parseFilter(new URLSearchParams())).toEqual(DEFAULT_FILTER);
  });

  it("drops invalid params to defaults", () => {
    const params = new URLSearchParams({
      project_status: "bogus",
      date_from: "not-a-date",
    });
    expect(parseFilter(params)).toEqual(DEFAULT_FILTER);
  });

  it("round-trips parse -> serialize, omitting empty fields", () => {
    const params = new URLSearchParams({
      date_from: "2026-01-01",
      client_id: "5",
    });
    const filter = parseFilter(params);
    expect(filterToParams(filter)).toEqual({
      date_from: "2026-01-01",
      client_id: "5",
    });
  });

  it("flags date_from > date_to", () => {
    expect(
      hasDateRangeError({ date_from: "2026-05-01", date_to: "2026-01-01" })
    ).toBe(true);
  });

  it("does not flag a valid range or a partial range", () => {
    expect(hasDateRangeError({ date_from: "2026-01-01", date_to: "2026-05-01" })).toBe(false);
    expect(hasDateRangeError({ date_from: "2026-01-01" })).toBe(false);
    expect(hasDateRangeError({})).toBe(false);
  });
});
