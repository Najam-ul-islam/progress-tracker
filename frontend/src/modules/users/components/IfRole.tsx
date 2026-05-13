import type { ReactNode } from "react";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";
import type { Role } from "@/modules/auth/types";

type IfRoleProps = {
  roles: readonly Role[];
  children: ReactNode;
};

export function IfRole({ roles, children }: IfRoleProps) {
  const role = useSessionStore(selectRole);
  if (role === null || !roles.includes(role)) return null;
  return <>{children}</>;
}

export function IfAdmin({ children }: { children: ReactNode }) {
  return <IfRole roles={["admin"]}>{children}</IfRole>;
}
