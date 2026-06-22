import { useQuery } from "@tanstack/react-query";
import {
  getDashboardSummary,
  REPORTING_QUERY_KEYS,
} from "@/modules/reporting/services/reporting.api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: REPORTING_QUERY_KEYS.dashboard(),
    queryFn: getDashboardSummary,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
