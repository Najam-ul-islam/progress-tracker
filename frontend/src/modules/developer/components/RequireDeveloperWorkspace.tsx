import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";

export function RequireDeveloperWorkspace({ children }: { children: ReactNode }) {
  const role = useSessionStore(selectRole);
  const location = useLocation();

  if (role !== "developer") {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}