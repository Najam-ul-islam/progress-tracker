import { useMySelfReport } from "@/modules/earnings/hooks/useMySelfReport";
import { OverviewCards } from "@/modules/developer/components/OverviewCards";
import { UpcomingDeadlines } from "@/modules/developer/components/UpcomingDeadlines";
import { NotificationsPanel } from "@/modules/developer/components/NotificationsPanel";
import { AssignedModulesTable } from "@/modules/developer/components/AssignedModulesTable";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/modules/reporting/components/ErrorState";

export function DeveloperOverviewPage() {
  const query = useMySelfReport();

  if (query.isPending) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        message="We couldn't load your dashboard data."
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
          Welcome back, {data.name}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Your developer workspace — projects, modules, earnings, and deadlines.
        </p>
      </div>

      <OverviewCards
        projectsCompleted={data.projects_completed}
        projectsPending={data.projects_pending}
        modulesCompleted={data.modules_completed}
        modulesInProgress={data.modules_in_progress}
        modulesPending={data.modules_pending}
        earningsPaid={data.earnings.paid}
        earningsPending={data.earnings.pending}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <UpcomingDeadlines />
          <AssignedModulesTable />
        </div>

        <div className="lg:col-span-1">
          <NotificationsPanel />
        </div>
      </div>
    </div>
  );
}