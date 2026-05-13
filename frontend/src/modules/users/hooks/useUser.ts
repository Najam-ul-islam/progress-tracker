import { useQuery } from "@tanstack/react-query";
import { USERS_QUERY_KEYS, usersApi } from "@/modules/users/services/users.api";

export function useUser(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: USERS_QUERY_KEYS.detail(id),
    queryFn: () => usersApi.get(id),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  });
}
