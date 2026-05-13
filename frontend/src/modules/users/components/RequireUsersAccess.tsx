import type { ReactNode } from "react";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";
import { canViewUsers } from "@/lib/rbac";
import { AccessDenied } from "@/modules/users/components/AccessDenied";

export function RequireUsersAccess({ children }: { children: ReactNode }) {
  const role = useSessionStore(selectRole);
  if (!canViewUsers(role)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}
