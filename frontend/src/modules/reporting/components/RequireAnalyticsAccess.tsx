import type { ReactNode } from "react";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";
import { canViewAnalytics } from "@/lib/rbac";
import { AccessDenied } from "@/modules/reporting/components/AccessDenied";

export function RequireAnalyticsAccess({ children }: { children: ReactNode }) {
  const role = useSessionStore(selectRole);
  if (!canViewAnalytics(role)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}
