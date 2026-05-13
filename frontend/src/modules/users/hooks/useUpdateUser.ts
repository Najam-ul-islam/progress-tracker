import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, USERS_QUERY_KEYS } from "@/modules/users/services/users.api";
import type { EditDraft, User } from "@/modules/users/types";

export type UpdateUserVariables = {
  id: number;
  draft: EditDraft;
};

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation<User, Error, UpdateUserVariables>({
    mutationFn: ({ id, draft }) => usersApi.update(id, draft),
    onSuccess: (updated) => {
      queryClient.setQueryData(USERS_QUERY_KEYS.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.detail(updated.id) });
    },
  });
}
