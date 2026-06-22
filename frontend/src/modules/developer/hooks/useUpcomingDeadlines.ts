import { useQuery } from "@tanstack/react-query";
import { useMySelfReport } from "@/modules/earnings/hooks/useMySelfReport";
import { useDeveloperProjects } from "./useDeveloperProjects";
import type { DeveloperSelfReport } from "@/modules/earnings/types";
import type { Project } from "@/modules/projects/types";

export interface ModuleWithDeadline {
  moduleId: number;
  moduleName: string;
  projectId: number;
  projectName: string;
  progress: number;
  status: "pending" | "in_progress" | "completed";
  deadline: Date | null;
  isOverdue: boolean;
  daysRemaining: number | null;
}

export function useUpcomingDeadlines() {
  const selfReportQuery = useMySelfReport();
  const projectsQuery = useDeveloperProjects();

  const derivedData = useQuery({
    queryKey: ["deadlines", "upcoming"] as const,
    queryFn: () => {
      if (!selfReportQuery.data || !projectsQuery.data) {
        return [];
      }
      return computeDeadlines(selfReportQuery.data, projectsQuery.data);
    },
    enabled: Boolean(selfReportQuery.data && projectsQuery.data),
  });

  return {
    ...derivedData,
    modulesWithDeadlines: derivedData.data ?? [],
  };
}

function computeDeadlines(
  report: DeveloperSelfReport,
  projects: Project[]
): ModuleWithDeadline[] {
  const projectMap = new Map(projects.map((p) => [p.id, p.endDate]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result: ModuleWithDeadline[] = [];

  for (const m of report.modules) {
    const deadlineStr = projectMap.get(m.project_id);
    const deadline = deadlineStr ? new Date(deadlineStr) : null;
    const isOverdue = deadline !== null && deadline < today && m.status !== "completed";

    let daysRemaining: number | null = null;
    if (deadline) {
      const diffMs = deadline.getTime() - today.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      daysRemaining = Math.ceil(diffDays);
    }

    result.push({
      moduleId: m.module_id,
      moduleName: m.module_name,
      projectId: m.project_id,
      projectName: m.project_name,
      progress: m.progress,
      status: m.status,
      deadline: deadline,
      isOverdue: isOverdue,
      daysRemaining: daysRemaining,
    });
  }

  // Sort: overdue items first, then by nearest deadline, items without deadline at end
  result.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && !b.deadline) return 0;
    return (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0);
  });

  return result;
}