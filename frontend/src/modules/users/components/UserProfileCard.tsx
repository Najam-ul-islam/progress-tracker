import { RoleBadge } from "@/modules/users/components/RoleBadge";
import { StatusBadge } from "@/modules/users/components/StatusBadge";
import type { User } from "@/modules/users/types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export function UserProfileCard({ user }: { user: User }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{user.name}</h2>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RoleBadge role={user.role} />
          <StatusBadge isActive={user.isActive} />
        </div>
      </header>
      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Created" value={formatDate(user.createdAt)} />
        <Field label="Updated" value={formatDate(user.updatedAt)} />
        {user.developer ? (
          <>
            <Field
              label="Hourly rate"
              value={user.developer.hourlyRate != null ? `$${user.developer.hourlyRate}` : "—"}
            />
            <Field
              label="Capacity (h/week)"
              value={user.developer.capacityHoursPerWeek ?? "—"}
            />
          </>
        ) : null}
      </dl>
    </article>
  );
}
