import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";

export function RequireDashboardAccess({ children }: { children: ReactNode }) {
  const role = useSessionStore(selectRole);
  if (role !== "admin" && role !== "manager" && role !== "developer") {
    return (
      <div
        role="alert"
        className="mx-auto mt-12 max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-lg font-semibold text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          The dashboard is available to authenticated users only.
        </p>
        <div className="mt-4">
          <Link
            to="/login"
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}