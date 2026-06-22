import type { ReactNode } from "react";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";
import { canViewClients } from "@/lib/rbac";
import { AccessDenied } from "@/modules/clients/components/AccessDenied";

export function RequireClientsAccess({ children }: { children: ReactNode }) {
  const role = useSessionStore(selectRole);
  if (!canViewClients(role)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}
