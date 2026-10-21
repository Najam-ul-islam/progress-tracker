import { Navigate, Outlet, useLocation } from "react-router-dom";
import { selectIsAuthenticated, useSessionStore } from "@/modules/auth/store/session.store";

export function RequireAuth() {
  const isAuthenticated = useSessionStore(selectIsAuthenticated);
  const lastClearReason = useSessionStore((s) => s.lastClearReason);
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search, reason: lastClearReason }}
      />
    );
  }
  return <Outlet />;
}
