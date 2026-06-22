import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi, CLIENTS_QUERY_KEYS } from "@/modules/clients/services/clients.api";
import type { Client, ClientDraft } from "@/modules/clients/types";

export type UpdateClientVariables = {
  id: number;
  draft: ClientDraft;
};

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation<Client, Error, UpdateClientVariables>({
    mutationFn: ({ id, draft }) => clientsApi.update(id, draft),
    onSuccess: (updated) => {
      queryClient.setQueryData(CLIENTS_QUERY_KEYS.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.detail(updated.id) });
    },
  });
}
