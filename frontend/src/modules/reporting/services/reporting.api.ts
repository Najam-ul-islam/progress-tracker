import { http } from "@/lib/http";
import type {
  ChartDataPoint,
  DashboardSummary,
  FinancialReportResponse,
  ProjectReportRow,
  DeveloperReportRow,
} from "@/modules/reporting/types";
import {
  filterToParams,
  type AnalyticsFilter,
} from "@/modules/reporting/schemas/analytics-filter.schema";

// Backend mounts the reporting router at `/reports` (backend/app/main.py).
const BASE = "/reports";

// `/reports/payments` does not accept developer_id — strip it before sending.
function paymentsParams(filter: AnalyticsFilter): Record<string, string> {
  const { developer_id: _omit, ...rest } = filter;
  void _omit;
  return filterToParams(rest);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await http.get<DashboardSummary>(`${BASE}/dashboard`);
  return res.data;
}

export async function getDashboardChartData(): Promise<ChartDataPoint[]> {
  const res = await http.get<{ items: ChartDataPoint[] }>(`${BASE}/dashboard/chart-data`);
  return res.data.items;
}

export async function getFinancialReport(
  filter: AnalyticsFilter = {}
): Promise<FinancialReportResponse> {
  const res = await http.get<FinancialReportResponse>(`${BASE}/payments`, {
    params: paymentsParams(filter),
  });
  return res.data;
}

export async function getProjectsReport(
  filter: AnalyticsFilter = {}
): Promise<ProjectReportRow[]> {
  const res = await http.get<ProjectReportRow[]>(`${BASE}/projects`, {
    params: filterToParams(filter),
  });
  return res.data;
}

export async function getDevelopersReport(
  filter: AnalyticsFilter = {}
): Promise<DeveloperReportRow[]> {
  const res = await http.get<DeveloperReportRow[]>(`${BASE}/developers`, {
    params: filterToParams(filter),
  });
  return res.data;
}

// React Query key factory. Filters are included in the key so each filter
// combination caches independently and refetches on change.
export const REPORTING_QUERY_KEYS = {
  dashboard: () => ["reports", "dashboard"] as const,
  dashboardChart: () => ["reports", "dashboard", "chart"] as const,
  payments: (f: AnalyticsFilter) => ["reports", "payments", paymentsParams(f)] as const,
  projects: (f: AnalyticsFilter) => ["reports", "projects", filterToParams(f)] as const,
  developers: (f: AnalyticsFilter) => ["reports", "developers", filterToParams(f)] as const,
  selfReport: () => ["reports", "developers", "me"] as const,
};
