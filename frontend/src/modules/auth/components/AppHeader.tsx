import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/modules/auth/hooks/useLogout";
import { useSessionStore } from "@/modules/auth/store/session.store";
import { IfRole } from "@/modules/users/components/IfRole";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";
import { cn } from "@/lib/cn";

export function AppHeader() {
  const user = useSessionStore((s) => s.user);
  const logout = useLogout();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <div className="text-sm font-semibold text-slate-900">Progress Tracker</div>
        <nav className="flex items-center gap-4 text-sm">
          <IfRole roles={["admin", "manager"]}>
            <NavLink
              to="/users"
              className={({ isActive }) =>
                cn(
                  "text-slate-600 hover:text-slate-900",
                  isActive && "font-medium text-slate-900"
                )
              }
            >
              Users
            </NavLink>
          </IfRole>
          <IfRole roles={["admin", "manager"]}>
            <NavLink
              to="/clients"
              className={({ isActive }) =>
                cn(
                  "text-slate-600 hover:text-slate-900",
                  isActive && "font-medium text-slate-900"
                )
              }
            >
              Clients
            </NavLink>
          </IfRole>
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              cn(
                "text-slate-600 hover:text-slate-900",
                isActive && "font-medium text-slate-900"
              )
            }
          >
            Projects
          </NavLink>
          <IfRole roles={["admin", "manager"]}>
            <NavLink
              to="/payments"
              className={({ isActive }) =>
                cn(
                  "text-slate-600 hover:text-slate-900",
                  isActive && "font-medium text-slate-900"
                )
              }
            >
              Payments
            </NavLink>
          </IfRole>
          <IfRole roles={["admin", "manager"]}>
            <NavLink
              to="/analytics"
              className={({ isActive }) =>
                cn(
                  "text-slate-600 hover:text-slate-900",
                  isActive && "font-medium text-slate-900"
                )
              }
            >
              Analytics
            </NavLink>
          </IfRole>
<IfRole roles={["developer"]}>
              <NavLink
                to="/earnings"
                className={({ isActive }) =>
                  cn("text-slate-600 hover:text-slate-900", isActive && "font-medium text-slate-900")
                }
              >
                My Earnings
              </NavLink>
            </IfRole>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn("text-slate-600 hover:text-slate-900", isActive && "font-medium text-slate-900")
              }
            >
              Settings
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
        <NotificationBell />
        {user ? (
          <span className="text-sm text-slate-600">
            {user.name} <span className="text-slate-400">·</span> {user.role}
          </span>
        ) : null}
        <Button variant="secondary" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
