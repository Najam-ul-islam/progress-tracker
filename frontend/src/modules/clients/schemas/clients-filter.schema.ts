import { z } from "zod";

export const clientsFilterSchema = z.object({
  q: z.string().default(""),
});

export type ClientsFilterInput = z.infer<typeof clientsFilterSchema>;

export const DEFAULT_FILTER: ClientsFilterInput = {
  q: "",
};

export function parseFilter(params: URLSearchParams): ClientsFilterInput {
  const result = clientsFilterSchema.safeParse({ q: params.get("q") ?? "" });
  return result.success ? result.data : DEFAULT_FILTER;
}

export function filterToParams(filter: ClientsFilterInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (filter.q) out.q = filter.q;
  return out;
}
