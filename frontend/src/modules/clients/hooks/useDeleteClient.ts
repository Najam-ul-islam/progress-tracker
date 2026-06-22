import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi, CLIENTS_QUERY_KEYS } from "@/modules/clients/services/clients.api";

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => clientsApi.remove(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.list() });
      queryClient.removeQueries({ queryKey: CLIENTS_QUERY_KEYS.detail(id) });
    },
  });
}
