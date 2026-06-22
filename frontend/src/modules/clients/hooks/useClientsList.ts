import { useQuery } from "@tanstack/react-query";
import { CLIENTS_QUERY_KEYS, clientsApi } from "@/modules/clients/services/clients.api";

export function useClientsList() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEYS.list(),
    queryFn: clientsApi.list,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
