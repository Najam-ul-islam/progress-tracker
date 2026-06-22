import { AppHeader } from "@/modules/auth/components/AppHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/modules/reporting/components/KpiCard";
import { ErrorState } from "@/modules/reporting/components/ErrorState";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { StatusBadge } from "@/modules/projects/components/StatusBadge";
import { ProgressBar } from "@/modules/projects/components/ProgressBar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useMySelfReport } from "@/modules/earnings/hooks/useMySelfReport";

function EarningsSkeleton() {
  return (
    <div className="space-y-6" data-testid="earnings-skeleton">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function DeveloperEarningsPage() {
  const query = useMySelfReport();

  let body: React.ReactNode;
  if (query.isPending) {
    body = <EarningsSkeleton />;
  } else if (query.isError) {
    body = <ErrorState message="We couldn't load your earnings report." onRetry={() => query.refetch()} />;
  } else {
    const data = query.data;
    body = (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Paid earnings" value={formatCurrency(data.earnings.paid)} />
          <KpiCard label="Pending earnings" value={formatCurrency(data.earnings.pending)} />
          <KpiCard label="Total earnings" value={formatCurrency(data.earnings.total)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned Modules</CardTitle>
          </CardHeader>
          <CardContent>
            {data.modules.length === 0 ? (
              <EmptyState 
                title="No assignments" 
                message="You don't have any active project modules assigned yet." 
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project / Module</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.modules.map((m) => (
                    <TableRow key={m.module_id}>
                      <TableCell>
                        <div className="font-medium">{m.module_name}</div>
                        <div className="text-xs text-slate-500">{m.project_name}</div>
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
                      <TableCell className="text-right">{formatPercent(m.share_percentage)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(m.amount_paid)}</TableCell>
                      <TableCell className="text-right text-slate-500">{formatCurrency(m.amount_pending)}</TableCell>
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
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">My Earnings</h1>
            <p className="text-sm text-slate-500">Your personal performance and payment breakdown.</p>
          </div>
        </div>
        {body}
      </main>
    </div>
  );
}
