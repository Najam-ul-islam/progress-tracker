import { useQuery } from "@tanstack/react-query";
import { CLIENTS_QUERY_KEYS, clientsApi } from "@/modules/clients/services/clients.api";

export function useClient(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEYS.detail(id),
    queryFn: () => clientsApi.get(id),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  });
}
