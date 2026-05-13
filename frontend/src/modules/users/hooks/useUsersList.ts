import { useQuery } from "@tanstack/react-query";
import { USERS_QUERY_KEYS, usersApi } from "@/modules/users/services/users.api";

export function useUsersList() {
  return useQuery({
    queryKey: USERS_QUERY_KEYS.list(),
    queryFn: usersApi.list,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
