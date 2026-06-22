import { NavLink } from "react-router-dom";
import { AppHeader } from "@/modules/auth/components/AppHeader";
import { RequireAnalyticsAccess } from "@/modules/reporting/components/RequireAnalyticsAccess";
import { ErrorState } from "@/modules/reporting/components/ErrorState";
import { KpiCardGrid } from "@/modules/reporting/components/KpiCardGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useDashboardSummary } from "@/modules/reporting/hooks/useDashboardSummary";

const ANALYTICS_TABS = [
  { to: "/analytics", label: "Overview", end: true },
  { to: "/analytics/revenue", label: "Revenue", end: false },
  { to: "/analytics/projects", label: "Projects", end: false },
  { to: "/analytics/developers", label: "Developers", end: false },
];

export function AnalyticsTabs() {
  return (
    <nav className="flex gap-4 border-b border-slate-200 text-sm">
      {ANALYTICS_TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              "-mb-px border-b-2 border-transparent pb-2 text-slate-500 hover:text-slate-900",
              isActive && "border-slate-900 font-medium text-slate-900"
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Shared chrome for every analytics page: app header, title, sub-nav tabs. */
export function AnalyticsLayout({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions}
        </div>
        <AnalyticsTabs />
        {children}
      </main>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="analytics-dashboard-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

function AnalyticsDashboardBody() {
  const query = useDashboardSummary();

  let body: React.ReactNode;
  if (query.isPending) {
    body = <DashboardSkeleton />;
  } else if (query.isError) {
    body = (
      <ErrorState message="We couldn't load the dashboard." onRetry={() => query.refetch()} />
    );
  } else {
    body = <KpiCardGrid summary={query.data} />;
  }

  return (
    <AnalyticsLayout title="Analytics" description="Live operations and financial overview.">
      {body}
    </AnalyticsLayout>
  );
}

export function AnalyticsDashboardPage() {
  return (
    <RequireAnalyticsAccess>
      <AnalyticsDashboardBody />
    </RequireAnalyticsAccess>
  );
}
