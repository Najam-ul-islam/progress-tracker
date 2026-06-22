import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  parseFilter,
  filterToParams,
  hasDateRangeError,
  DEFAULT_FILTER,
  type AnalyticsFilter,
} from "@/modules/reporting/schemas/analytics-filter.schema";

// Binds the analytics filter set to the URL query string (source of truth).
// `dateError` is a client-side guard (date_from > date_to) surfaced before any
// request is issued.
export function useAnalyticsFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams);

  const setFilter = useCallback(
    (next: AnalyticsFilter) => {
      setSearchParams(filterToParams(next), { replace: true });
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams(filterToParams(DEFAULT_FILTER), { replace: true });
  }, [setSearchParams]);

  return {
    filter,
    setFilter,
    clearFilters,
    dateError: hasDateRangeError(filter),
  };
}
