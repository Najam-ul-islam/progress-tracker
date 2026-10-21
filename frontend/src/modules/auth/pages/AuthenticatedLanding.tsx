import { AppHeader } from "@/modules/auth/components/AppHeader";
import { useSessionStore } from "@/modules/auth/store/session.store";

export function AuthenticatedLanding() {
  const user = useSessionStore((s) => s.user);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h1>
        {user ? (
          <p className="mt-2 text-sm text-slate-600">
            Signed in as <span className="font-medium">{user.email}</span> ({user.role})
          </p>
        ) : null}
      </main>
    </div>
  );
}
