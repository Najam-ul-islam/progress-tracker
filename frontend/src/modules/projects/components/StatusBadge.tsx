import { cn } from "@/lib/cn";
import type { ProjectStatus, ModuleStatus } from "@/modules/projects/types";

interface StatusBadgeProps {
  status: ProjectStatus | ModuleStatus;
  className?: string;
}

const statusStyles: Record<ProjectStatus | ModuleStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  active: "bg-indigo-50 text-indigo-700 border-indigo-100",
  in_progress: "bg-blue-50 text-blue-700 border-blue-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const statusLabels: Record<ProjectStatus | ModuleStatus, string> = {
  pending: "Pending",
  active: "Active",
  in_progress: "In Progress",
  completed: "Completed",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
