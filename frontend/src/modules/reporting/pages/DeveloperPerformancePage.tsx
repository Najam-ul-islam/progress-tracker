import { AnalyticsLayout } from "@/modules/reporting/pages/AnalyticsDashboardPage";
import { RequireAnalyticsAccess } from "@/modules/reporting/components/RequireAnalyticsAccess";
import { ErrorState } from "@/modules/reporting/components/ErrorState";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { DeveloperEarningsChart } from "@/modules/reporting/components/charts/DeveloperEarningsChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useDevelopersReport } from "@/modules/reporting/hooks/useDevelopersReport";
import { useAnalyticsFilter } from "@/modules/reporting/hooks/useAnalyticsFilter";
import { AnalyticsFilters } from "@/modules/reporting/components/AnalyticsFilters";

function DevelopersSkeleton() {
  return (
    <div className="space-y-4" data-testid="developers-analytics-skeleton">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

function DeveloperPerformanceBody() {
  const { filter, dateError } = useAnalyticsFilter();
  const query = useDevelopersReport(dateError ? {} : filter);

  let body: React.ReactNode;
  if (query.isPending) {
    body = <DevelopersSkeleton />;
  } else if (query.isError) {
    body = <ErrorState message="We couldn't load the developer performance report." onRetry={() => query.refetch()} />;
  } else {
    const developers = query.data;
    body = (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DeveloperEarningsChart developers={developers} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Developer metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {developers.length === 0 ? (
              <EmptyState title="No developers found" message="No developers match the current filters." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Developer</TableHead>
                    <TableHead className="text-center">Modules</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right font-semibold">Total Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {developers.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <div>{d.name}</div>
                        <div className="text-xs text-slate-500">{d.email}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm font-medium">{d.module_count}</div>
                        <div className="text-[10px] text-slate-500">
                          {d.modules_completed} done / {d.modules_in_progress} in progress
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(d.earnings.paid)}</TableCell>
                      <TableCell className="text-right text-slate-500">{formatCurrency(d.earnings.pending)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(d.earnings.total)}</TableCell>
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
    <AnalyticsLayout title="Developer performance" description="Workload, module completion, and earnings across the team.">
      <div className="space-y-6">
        <AnalyticsFilters showDeveloperFilter />
        {body}
      </div>
    </AnalyticsLayout>
  );
}

export function DeveloperPerformancePage() {
  return (
    <RequireAnalyticsAccess>
      <DeveloperPerformanceBody />
    </RequireAnalyticsAccess>
  );
}
