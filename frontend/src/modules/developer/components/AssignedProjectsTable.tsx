import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProgressBar } from "@/modules/projects/components/ProgressBar";
import { StatusBadge } from "@/modules/projects/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { ErrorState } from "@/modules/reporting/components/ErrorState";
import { useDeveloperProjects } from "@/modules/developer/hooks/useDeveloperProjects";

export function AssignedProjectsTable() {
  const query = useDeveloperProjects();

  if (query.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            message="We couldn't load your assigned projects."
            onRetry={() => query.refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const projects = query.data;

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="No assigned projects"
            message="You are not assigned to any projects yet."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My Projects</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Timeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium text-slate-900">{p.name}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
                <TableCell className="w-40">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={0} className="h-2 w-full" />
                    <span className="text-xs font-medium"> — </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-600">
                    {p.startDate && p.endDate
                      ? `${new Date(p.startDate).toLocaleDateString()} → ${new Date(p.endDate).toLocaleDateString()}`
                      : "No timeline"}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}