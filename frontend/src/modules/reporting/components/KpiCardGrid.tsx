import { KpiCard } from "@/modules/reporting/components/KpiCard";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { DashboardSummary } from "@/modules/reporting/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export function KpiCardGrid({ summary }: { summary: DashboardSummary }) {
  const { projects, developers, payments } = summary;
  return (
    <div className="space-y-8">
      <Section title="Projects">
        <KpiCard label="Total projects" value={String(projects.total)} />
        <KpiCard label="Active" value={String(projects.active)} />
        <KpiCard label="Completed" value={String(projects.completed)} />
        <KpiCard
          label="Overdue"
          value={String(projects.overdue)}
          hint={`${projects.pending} pending`}
        />
      </Section>

      <Section title="Developers">
        <KpiCard label="Total developers" value={String(developers.total)} />
        <KpiCard
          label="With active assignments"
          value={String(developers.with_active_assignments)}
        />
        <KpiCard
          label="Avg module progress"
          value={formatPercent(developers.average_module_progress)}
        />
      </Section>

      <Section title="Payments">
        <KpiCard label="Total revenue" value={formatCurrency(payments.total_revenue)} />
        <KpiCard label="Company reserve" value={formatCurrency(payments.total_company_reserve)} />
        <KpiCard
          label="Disbursed to developers"
          value={formatCurrency(payments.total_developer_disbursed)}
        />
        <KpiCard label="Pending" value={formatCurrency(payments.pending_amount)} />
        {Number(payments.unbilled_revenue) > 0 && (
<KpiCard label="Unbilled (Completed)" value={formatCurrency(payments.unbilled_revenue)} />
        )}
      </Section>
    </div>
  );
}
