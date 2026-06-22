import { useQuery } from "@tanstack/react-query";
import {
  getProjectsReport,
  REPORTING_QUERY_KEYS,
} from "@/modules/reporting/services/reporting.api";
import type { AnalyticsFilter } from "@/modules/reporting/schemas/analytics-filter.schema";

export function useProjectsReport(filter: AnalyticsFilter = {}) {
  return useQuery({
    queryKey: REPORTING_QUERY_KEYS.projects(filter),
    queryFn: () => getProjectsReport(filter),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
