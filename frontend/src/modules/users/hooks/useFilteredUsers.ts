import { useMemo } from "react";
import type { User } from "@/modules/users/types";
import type { UsersFilterInput } from "@/modules/users/schemas/users-filter.schema";

export function filterUsers(users: User[], filter: UsersFilterInput): User[] {
  const q = filter.q.trim().toLowerCase();
  return users.filter((u) => {
    if (q) {
      const hay = `${u.name} ${u.email}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filter.role !== "any" && u.role !== filter.role) return false;
    if (filter.status === "active" && !u.isActive) return false;
    if (filter.status === "inactive" && u.isActive) return false;
    return true;
  });
}

export function useFilteredUsers(users: User[] | undefined, filter: UsersFilterInput): User[] {
  return useMemo(() => (users ? filterUsers(users, filter) : []), [users, filter]);
}
