import { useQuery } from "@tanstack/react-query";
import {
  getDevelopersReport,
  REPORTING_QUERY_KEYS,
} from "@/modules/reporting/services/reporting.api";
import type { AnalyticsFilter } from "@/modules/reporting/schemas/analytics-filter.schema";

export function useDevelopersReport(filter: AnalyticsFilter = {}) {
  return useQuery({
    queryKey: REPORTING_QUERY_KEYS.developers(filter),
    queryFn: () => getDevelopersReport(filter),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
