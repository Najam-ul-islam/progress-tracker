import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/modules/auth/hooks/useLogout";
import { useSessionStore } from "@/modules/auth/store/session.store";
import { IfRole } from "@/modules/users/components/IfRole";
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
        </nav>
      </div>
      <div className="flex items-center gap-3">
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
