import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, USERS_QUERY_KEYS } from "@/modules/users/services/users.api";
import type { User } from "@/modules/users/types";

export type UpdateUserStatusVariables = {
  id: number;
  isActive: boolean;
};

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation<User, Error, UpdateUserStatusVariables>({
    mutationFn: ({ id, isActive }) => usersApi.updateStatus(id, isActive),
    onSuccess: (updated) => {
      queryClient.setQueryData(USERS_QUERY_KEYS.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEYS.detail(updated.id) });
    },
  });
}
