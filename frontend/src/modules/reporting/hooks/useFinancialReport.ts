import { useQuery } from "@tanstack/react-query";
import {
  getFinancialReport,
  REPORTING_QUERY_KEYS,
} from "@/modules/reporting/services/reporting.api";
import type { AnalyticsFilter } from "@/modules/reporting/schemas/analytics-filter.schema";

export function useFinancialReport(filter: AnalyticsFilter = {}) {
  return useQuery({
    queryKey: REPORTING_QUERY_KEYS.payments(filter),
    queryFn: () => getFinancialReport(filter),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
