import { z } from "zod";

export const ROLE_FILTER_VALUES = ["any", "admin", "manager", "developer"] as const;
export const STATUS_FILTER_VALUES = ["all", "active", "inactive"] as const;

export const usersFilterSchema = z.object({
  q: z.string().default(""),
  role: z.enum(ROLE_FILTER_VALUES).default("any"),
  status: z.enum(STATUS_FILTER_VALUES).default("all"),
});

export type UsersFilterInput = z.infer<typeof usersFilterSchema>;

export const DEFAULT_FILTER: UsersFilterInput = {
  q: "",
  role: "any",
  status: "all",
};

export function parseFilter(params: URLSearchParams): UsersFilterInput {
  const raw = {
    q: params.get("q") ?? "",
    role: params.get("role") ?? "any",
    status: params.get("status") ?? "all",
  };
  const result = usersFilterSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_FILTER;
}

export function filterToParams(filter: UsersFilterInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (filter.q) out.q = filter.q;
  if (filter.role !== "any") out.role = filter.role;
  if (filter.status !== "all") out.status = filter.status;
  return out;
}
