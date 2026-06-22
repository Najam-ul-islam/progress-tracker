import { z } from "zod";
import type { ProjectStatus } from "@/modules/reporting/types";

// The active filter set for the aggregate analytics views. The URL query string
// is the source of truth (shareable / restorable); this schema parses params in
// and serializes them back out, mirroring clients-filter.schema.ts.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const analyticsFilterSchema = z.object({
  date_from: z.string().regex(ISO_DATE).optional(),
  date_to: z.string().regex(ISO_DATE).optional(),
  project_status: z.enum(["pending", "active", "completed"]).optional(),
  client_id: z.number().int().positive().optional(),
  developer_id: z.number().int().positive().optional(),
});

export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;

export const DEFAULT_FILTER: AnalyticsFilter = {};

/** True when both bounds are present and from is after to (client-side guard). */
export function hasDateRangeError(filter: AnalyticsFilter): boolean {
  return (
    !!filter.date_from && !!filter.date_to && filter.date_from > filter.date_to
  );
}

/** Tolerant parse of URL params → typed filter; unparseable params drop to undefined. */
export function parseFilter(params: URLSearchParams): AnalyticsFilter {
  const clientIdRaw = params.get("client_id");
  const developerIdRaw = params.get("developer_id");
  const candidate = {
    date_from: params.get("date_from") ?? undefined,
    date_to: params.get("date_to") ?? undefined,
    project_status: params.get("project_status") ?? undefined,
    client_id: clientIdRaw ? Number(clientIdRaw) : undefined,
    developer_id: developerIdRaw ? Number(developerIdRaw) : undefined,
  };
  const result = analyticsFilterSchema.safeParse(candidate);
  return result.success ? result.data : DEFAULT_FILTER;
}

/** Serialize a filter to a clean param record (omits empty fields). */
export function filterToParams(filter: AnalyticsFilter): Record<string, string> {
  const out: Record<string, string> = {};
  if (filter.date_from) out.date_from = filter.date_from;
  if (filter.date_to) out.date_to = filter.date_to;
  if (filter.project_status) out.project_status = filter.project_status;
  if (filter.client_id) out.client_id = String(filter.client_id);
  if (filter.developer_id) out.developer_id = String(filter.developer_id);
  return out;
}

export type { ProjectStatus };
