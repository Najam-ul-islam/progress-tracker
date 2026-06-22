import { AnalyticsLayout } from "@/modules/reporting/pages/AnalyticsDashboardPage";
import { RequireAnalyticsAccess } from "@/modules/reporting/components/RequireAnalyticsAccess";
import { ErrorState } from "@/modules/reporting/components/ErrorState";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { RevenueCompositionChart } from "@/modules/reporting/components/charts/RevenueCompositionChart";
import { KpiCard } from "@/modules/reporting/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/modules/projects/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useFinancialReport } from "@/modules/reporting/hooks/useFinancialReport";
import { useAnalyticsFilter } from "@/modules/reporting/hooks/useAnalyticsFilter";
import { AnalyticsFilters } from "@/modules/reporting/components/AnalyticsFilters";

function RevenueSkeleton() {
  return (
    <div className="space-y-4" data-testid="revenue-skeleton">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function RevenueAnalyticsBody() {
  const { filter, dateError } = useAnalyticsFilter();
  const query = useFinancialReport(dateError ? {} : filter);

  let body: React.ReactNode;
  if (query.isPending) {
    body = <RevenueSkeleton />;
  } else if (query.isError) {
    body = <ErrorState message="We couldn't load the revenue report." onRetry={() => query.refetch()} />;
  } else {
    const { rows, totals } = query.data;
    body = (
      <div className="space-y-6">
        <AnalyticsFilters showDeveloperFilter={false} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total invoiced" value={formatCurrency(totals.invoiced)} />
          <KpiCard label="Company share" value={formatCurrency(totals.company_share)} />
          <KpiCard label="Developer share" value={formatCurrency(totals.developer_share)} />
          <KpiCard label="Outstanding" value={formatCurrency(totals.outstanding)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue composition</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueCompositionChart totals={totals} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-project breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <EmptyState title="No revenue data" message="No projects match the current filters." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Company</TableHead>
                    <TableHead className="text-right">Developer</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.project_id}>
                      <TableCell>{row.project_name}</TableCell>
                      <TableCell>{row.client_name}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.invoiced)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.company_share)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.developer_share)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.outstanding)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={3}>Totals</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.invoiced)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.company_share)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.developer_share)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.outstanding)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AnalyticsLayout title="Revenue analytics" description="Company reserve, developer share, and outstanding by project.">
      {body}
    </AnalyticsLayout>
  );
}

export function RevenueAnalyticsPage() {
  return (
    <RequireAnalyticsAccess>
      <RevenueAnalyticsBody />
    </RequireAnalyticsAccess>
  );
}
