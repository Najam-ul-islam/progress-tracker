import { AppHeader } from "@/modules/auth/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/modules/users/components/RoleBadge";
import { useSessionStore } from "@/modules/auth/store/session.store";

export function SettingsPage() {
  const user = useSessionStore((s) => s.user);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Manage your account preferences and profile.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Name</label>
                <p className="mt-1 text-sm text-slate-900">{user?.name ?? "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</label>
                <p className="mt-1 text-sm text-slate-900">{user?.email ?? "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</label>
                <div className="mt-1">
                  <RoleBadge role={user?.role ?? "developer"} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}