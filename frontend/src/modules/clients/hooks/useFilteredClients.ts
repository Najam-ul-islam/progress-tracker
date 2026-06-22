import { useMemo } from "react";
import type { Client } from "@/modules/clients/types";
import type { ClientsFilterInput } from "@/modules/clients/schemas/clients-filter.schema";

export function filterClients(clients: Client[], filter: ClientsFilterInput): Client[] {
  const q = filter.q.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter((c) => {
    const hay = `${c.name} ${c.companyName ?? ""} ${c.email} ${c.phone}`.toLowerCase();
    return hay.includes(q);
  });
}

export function useFilteredClients(
  clients: Client[] | undefined,
  filter: ClientsFilterInput
): Client[] {
  return useMemo(() => (clients ? filterClients(clients, filter) : []), [clients, filter]);
}
