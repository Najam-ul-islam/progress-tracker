import { KpiCard } from "@/modules/reporting/components/KpiCard";
import { formatCurrency } from "@/lib/format";

interface OverviewCardsProps {
  projectsCompleted: number;
  projectsPending: number;
  modulesCompleted: number;
  modulesInProgress: number;
  modulesPending: number;
  earningsPaid: string;
  earningsPending: string;
}

export function OverviewCards({
  projectsCompleted,
  projectsPending,
  modulesCompleted,
  modulesInProgress,
  modulesPending,
  earningsPaid,
  earningsPending,
}: OverviewCardsProps) {
  const totalModules = modulesCompleted + modulesInProgress + modulesPending;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Active Projects"
        value={String(projectsPending)}
        hint={`${projectsCompleted} completed`}
      />
      <KpiCard
        label="Assigned Modules"
        value={String(totalModules)}
        hint={`${modulesCompleted} completed • ${modulesInProgress} in progress`}
      />
      <KpiCard
        label="Pending Tasks"
        value={String(modulesInProgress + modulesPending)}
        hint="modules needing work"
      />
      <KpiCard
        label="Total Earnings"
        value={formatCurrency(earningsPaid)}
        hint={`${formatCurrency(earningsPending)} pending`}
      />
    </div>
  );
}