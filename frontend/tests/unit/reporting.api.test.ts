import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/server";
import {
  getFinancialReport,
  getProjectsReport,
  getDevelopersReport,
  REPORTING_QUERY_KEYS,
} from "@/modules/reporting/services/reporting.api";

const BASE = "http://localhost:8000";

function captureUrl(endpoint: string, body: unknown) {
  let captured = "";
  server.use(
    http.get(`${BASE}/reports/${endpoint}`, ({ request }) => {
      captured = new URL(request.url).search;
      return HttpResponse.json(body);
    })
  );
  return () => captured;
}

afterEach(() => server.resetHandlers());

describe("reporting.api request building", () => {
  it("targets /reports/* (not /reporting/*) and serializes filters", async () => {
    const url = captureUrl("projects", []);
    await getProjectsReport({
      date_from: "2026-01-01",
      project_status: "active",
      client_id: 5,
      developer_id: 7,
    });
    const params = new URLSearchParams(url());
    expect(params.get("date_from")).toBe("2026-01-01");
    expect(params.get("project_status")).toBe("active");
    expect(params.get("client_id")).toBe("5");
    expect(params.get("developer_id")).toBe("7");
  });

  it("OMITS developer_id from the payments request", async () => {
    const url = captureUrl("payments", { rows: [], totals: {} });
    await getFinancialReport({ client_id: 5, developer_id: 7, project_status: "active" });
    const params = new URLSearchParams(url());
    expect(params.get("developer_id")).toBeNull();
    expect(params.get("client_id")).toBe("5");
    expect(params.get("project_status")).toBe("active");
  });

  it("sends no params when filter is empty", async () => {
    const url = captureUrl("developers", []);
    await getDevelopersReport();
    expect(url()).toBe("");
  });
});

describe("REPORTING_QUERY_KEYS", () => {
  it("excludes developer_id from the payments cache key", () => {
    const key = REPORTING_QUERY_KEYS.payments({ client_id: 1, developer_id: 9 });
    expect(JSON.stringify(key)).not.toContain("developer_id");
  });

  it("includes filters in the projects cache key", () => {
    const key = REPORTING_QUERY_KEYS.projects({ project_status: "active" });
    expect(JSON.stringify(key)).toContain("active");
  });
});
