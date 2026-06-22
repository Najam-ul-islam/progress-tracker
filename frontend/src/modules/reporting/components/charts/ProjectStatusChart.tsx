import {
  ChartContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "@/components/ui/chart";
import { CHART_COLORS } from "@/components/ui/chart-colors";
import type { ProjectReportRow } from "@/modules/reporting/types";

// Count of projects by status across the (filtered) portfolio. Presentational —
// the page table lists the same projects (the accessible source of truth).
export function ProjectStatusChart({ projects }: { projects: ProjectReportRow[] }) {
  const counts = { pending: 0, active: 0, completed: 0 };
  for (const p of projects) counts[p.status] += 1;
  const data = [
    { status: "Pending", count: counts.pending },
    { status: "Active", count: counts.active },
    { status: "Completed", count: counts.completed },
  ];

  return (
    <ChartContainer ariaLabel="Project count by status">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="status" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
