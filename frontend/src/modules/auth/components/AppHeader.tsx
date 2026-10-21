import { Button } from "@/components/ui/button";
import { useLogout } from "@/modules/auth/hooks/useLogout";
import { useSessionStore } from "@/modules/auth/store/session.store";

export function AppHeader() {
  const user = useSessionStore((s) => s.user);
  const logout = useLogout();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="text-sm font-semibold text-slate-900">Progress Tracker</div>
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
