import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  clientsApi,
  CLIENTS_QUERY_KEYS,
  type ClientCreateBodyWire,
} from "@/modules/clients/services/clients.api";
import type { Client } from "@/modules/clients/types";

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, ClientCreateBodyWire>({
    mutationFn: (body) => clientsApi.create(body),
    onSuccess: (created) => {
      queryClient.setQueryData(CLIENTS_QUERY_KEYS.detail(created.id), created);
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.list() });
    },
  });
}
