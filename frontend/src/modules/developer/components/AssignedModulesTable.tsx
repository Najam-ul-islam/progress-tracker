import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/modules/projects/components/ProgressBar";
import { StatusBadge } from "@/modules/projects/components/StatusBadge";
import { UpdateProgressDialog } from "@/modules/projects/components/UpdateProgressDialog";
import { formatCurrency } from "@/lib/format";
import type { DeveloperSelfModule } from "@/modules/earnings/types";
import { useMySelfReport } from "@/modules/earnings/hooks/useMySelfReport";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { ErrorState } from "@/modules/reporting/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

export function AssignedModulesTable() {
  const [updatingModule, setUpdatingModule] = useState<DeveloperSelfModule | null>(null);
  const query = useMySelfReport();

  if (query.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Modules</CardTitle>
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
            message="We couldn't load your assigned modules."
            onRetry={() => query.refetch()}
          />
        </CardContent>
      </Card>
    );
  }

  const data = query.data;
  const modules = data.modules;

  if (modules.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="No assigned modules"
            message="You don't have any modules assigned yet."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Share %</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map(m => (
                <TableRow key={m.module_id}>
                  <TableCell>
                    <div className="font-medium text-slate-900">{m.module_name}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-600">{m.project_name}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="w-40">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={m.progress} className="h-2 w-full" />
                      <span className="text-xs font-medium">{m.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(m.share_percentage) || 0).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(m.amount_paid)}
                  </TableCell>
                  <TableCell className="text-right text-slate-500">
                    {formatCurrency(m.amount_pending)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setUpdatingModule(m)}
                    >
                      Update
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {updatingModule && (
        <UpdateProgressDialog
          moduleId={updatingModule.module_id}
          moduleName={updatingModule.module_name}
          currentProgress={updatingModule.progress}
          projectId={updatingModule.project_id}
          open={true}
          onOpenChange={open => {
            if (!open) setUpdatingModule(null);
          }}
        />
      )}
    </>
  );
}