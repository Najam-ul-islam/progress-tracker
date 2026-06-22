import { AnalyticsLayout } from "@/modules/reporting/pages/AnalyticsDashboardPage";
import { RequireAnalyticsAccess } from "@/modules/reporting/components/RequireAnalyticsAccess";
import { ErrorState } from "@/modules/reporting/components/ErrorState";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { ProjectStatusChart } from "@/modules/reporting/components/charts/ProjectStatusChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/modules/projects/components/StatusBadge";
import { ProgressBar } from "@/modules/projects/components/ProgressBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectsReport } from "@/modules/reporting/hooks/useProjectsReport";
import { useAnalyticsFilter } from "@/modules/reporting/hooks/useAnalyticsFilter";
import { AnalyticsFilters } from "@/modules/reporting/components/AnalyticsFilters";

function ProjectsSkeleton() {
  return (
    <div className="space-y-4" data-testid="projects-analytics-skeleton">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function ProjectAnalyticsBody() {
  const { filter, dateError } = useAnalyticsFilter();
  const query = useProjectsReport(dateError ? {} : filter);

  let body: React.ReactNode;
  if (query.isPending) {
    body = <ProjectsSkeleton />;
  } else if (query.isError) {
    body = <ErrorState message="We couldn't load the projects report." onRetry={() => query.refetch()} />;
  } else {
    const projects = query.data;
    body = (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio status</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectStatusChart projects={projects} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState title="No projects found" message="No projects match the current filters." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-center">Modules</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div>{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.start_date} to {p.end_date}
                        </div>
                      </TableCell>
                      <TableCell>{p.client_name}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={p.overall_progress} className="h-2 w-full" />
                          <span className="text-xs font-medium">{p.overall_progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm font-medium">{p.module_count}</div>
                        <div className="text-[10px] text-slate-500">
                          {p.modules_completed} done / {p.modules_in_progress} in progress
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AnalyticsLayout title="Project analytics" description="Portfolio distribution, progress, and module health.">
      <div className="space-y-6">
        <AnalyticsFilters showDeveloperFilter />
        {body}
      </div>
    </AnalyticsLayout>
  );
}

export function ProjectAnalyticsPage() {
  return (
    <RequireAnalyticsAccess>
      <ProjectAnalyticsBody />
    </RequireAnalyticsAccess>
  );
}
