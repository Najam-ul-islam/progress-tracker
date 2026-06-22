import { useMemo } from "react";
import { KPICard } from "../components/KPICard";
import { DataTable, type ColumnDef } from "../components/DataTable";
import { MetricsChart, type ChartDataPoint } from "../components/MetricsChart";
import { ActivityFeed } from "../components/ActivityFeed";
import {
  useDashboardSummary,
  useDashboardChartData,
  useDashboardUsers,
  useDashboardActivity,
  mapUserToTableItem,
  mapNotificationToActivity,
} from "../hooks/useDashboardData";
import type { UserTableItem } from "../services/mockData";
import {
  useSessionStore,
  selectRole,
} from "@/modules/auth/store/session.store";
import { useMySelfReport } from "@/modules/earnings/hooks/useMySelfReport";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/modules/projects/components/StatusBadge";
import { ProgressBar } from "@/modules/projects/components/ProgressBar";
import { EmptyState } from "@/modules/reporting/components/EmptyState";
import { ErrorState } from "@/modules/reporting/components/ErrorState";

// --- Reusable Presentation Subcomponent ---
function DashboardHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-1 pb-2 border-b border-slate-100 dark:border-slate-900">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 font-heading">
        {title}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

// --- Admin/Manager View Layout ---
function DashboardContent() {
  const summaryQuery = useDashboardSummary();
  const chartQuery = useDashboardChartData();
  const usersQuery = useDashboardUsers();
  const activityQuery = useDashboardActivity();

  const isLoading = summaryQuery.isLoading || chartQuery.isLoading;

  const kpis = useMemo(() => {
    if (!summaryQuery.data) return [];
    const { projects, developers, payments } = summaryQuery.data;
    return [
      {
        label: "Total Revenue",
        value: Number(payments.total_revenue).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }),
        delta: "—",
        trend: "neutral" as const,
        description: "all-time billed",
      },
      {
        label: "Active Users",
        value: String(developers.total),
        delta: developers.with_active_assignments
          ? `${developers.with_active_assignments} assigned`
          : undefined,
        trend: "neutral" as const,
        description: "developers platform-wide",
      },
      {
        label: "Projects",
        value: String(projects.total),
        delta: `${projects.active} active`,
        trend: "neutral" as const,
        description: `${projects.pending} pending authorization`,
      },
      {
        label: "Pending Payments",
        value: Number(payments.pending_amount).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }),
        delta: undefined,
        trend: "neutral" as const,
        description: "awaiting collection status",
      },
    ];
  }, [summaryQuery.data]);

  const chartData: ChartDataPoint[] = chartQuery.data ?? [];
  const tableData: UserTableItem[] = useMemo(
    () => (usersQuery.data ?? []).map(mapUserToTableItem),
    [usersQuery.data],
  );
  const activityData = useMemo(
    () => (activityQuery.data ?? []).map(mapNotificationToActivity),
    [activityQuery.data],
  );

  const columns: ColumnDef<UserTableItem>[] = [
    {
      key: "name",
      header: "User Name",
      render: (item) => (
        <div className="font-medium text-slate-900 dark:text-slate-100">
          {item.name}
        </div>
      ),
    },
    { key: "email", header: "Email Address" },
    {
      key: "role",
      header: "Role",
      render: (item) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800">
          {item.role}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => {
        const styles: Record<string, string> = {
          active:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
          suspended:
            "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30",
          pending:
            "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
        };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold tracking-wide border ${styles[item.status] || styles.pending}`}
          >
            {item.status.toUpperCase()}
          </span>
        );
      },
    },
    { key: "createdAt", header: "Joined" },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-14 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/40 dark:border-slate-800/40"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        title="Dashboard"
        description="Platform overview — revenue metrics, users infrastructure, and recent system logs."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 flex flex-col gap-6 w-full">
          <MetricsChart data={chartData} title="Platform Analytics Overview" />
          <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-1">
            <DataTable
              data={tableData}
              columns={columns}
              pageSize={5}
              searchKey="name"
              searchPlaceholder="Filter users by name…"
            />
          </div>
        </div>
        <div className="lg:col-span-1">
          <ActivityFeed events={activityData} />
        </div>
      </div>
    </div>
  );
}

// --- Personalized Developer View Layout ---
function DeveloperDashboardContent() {
  const query = useMySelfReport();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-14 w-1/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/40 dark:border-slate-800/40"
            />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        message="We couldn't retrieve your profile dashboard matrix values."
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;

  const kpis = [
    {
      label: "Projects Completed",
      value: String(data.projects_completed),
      description: "successfully delivered milestone products",
      trend: "neutral" as const,
    },
    {
      label: "Pending Projects",
      value: String(data.projects_pending),
      description: "currently active / in development pipeline",
      trend: "neutral" as const,
    },
    {
      label: "Total Earnings",
      value: formatCurrency(data.earnings_from_completed_projects),
      description: "cleared assets from closed contracts",
      trend: "neutral" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <DashboardHeader
        title={`Welcome back, ${data.name}`}
        description="Your personalized developer workspace — current project progression and billing tracking."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <Card className="shadow-sm border-slate-200/70 dark:border-slate-800/80 overflow-hidden bg-white dark:bg-slate-900/40 backdrop-blur-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 py-4">
          <CardTitle className="text-sm font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
            Assigned Project Modules
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.modules.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No active assignments"
                message="Your portfolio pipeline is clean. You do not have active tasks currently."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 dark:bg-slate-900/40">
                  <TableRow className="hover:bg-transparent border-b border-slate-200/60 dark:border-slate-800">
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 h-11">
                      Project / Module
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 h-11">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 h-11">
                      Progress
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right h-11">
                      Share
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right h-11">
                      Paid
                    </TableHead>
                    <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right h-11">
                      Pending
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.modules.map((m) => (
                    <TableRow
                      key={m.module_id}
                      className="border-b border-slate-100 dark:border-slate-800/60 last:border-none hover:bg-slate-50/40 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <TableCell className="py-3.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {m.module_name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {m.project_name}
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <StatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="w-44 py-3.5">
                        <div className="flex items-center gap-3">
                          <ProgressBar
                            value={m.progress}
                            className="h-1.5 w-full bg-slate-100 dark:bg-slate-800"
                          />
                          <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                            {m.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-slate-600 dark:text-slate-400 py-3.5">
                        {Number(m.share_percentage).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 py-3.5">
                        {formatCurrency(m.amount_paid)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-slate-500 dark:text-slate-500 py-3.5">
                        {formatCurrency(m.amount_pending)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Entry Point Guard Layer ---
export function DashboardPage() {
  const role = useSessionStore(selectRole);

  if (role === "developer") {
    return <DeveloperDashboardContent />;
  }

  return <DashboardContent />;
}

// import { useMemo } from "react";
// import { KPICard } from "../components/KPICard";
// import { DataTable, type ColumnDef } from "../components/DataTable";
// import { MetricsChart, type ChartDataPoint } from "../components/MetricsChart";
// import { ActivityFeed } from "../components/ActivityFeed";
// import {
//   useDashboardSummary,
//   useDashboardChartData,
//   useDashboardUsers,
//   useDashboardActivity,
//   mapUserToTableItem,
//   mapNotificationToActivity,
// } from "../hooks/useDashboardData";
// import type { UserTableItem } from "../services/mockData";
// import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";
// import { useMySelfReport } from "@/modules/earnings/hooks/useMySelfReport";
// import { formatCurrency } from "@/lib/format";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { StatusBadge } from "@/modules/projects/components/StatusBadge";
// import { ProgressBar } from "@/modules/projects/components/ProgressBar";
// import { EmptyState } from "@/modules/reporting/components/EmptyState";
// import { ErrorState } from "@/modules/reporting/components/ErrorState";

// function DashboardContent() {
//   const summaryQuery = useDashboardSummary();
//   const chartQuery = useDashboardChartData();
//   const usersQuery = useDashboardUsers();
//   const activityQuery = useDashboardActivity();

//   const isLoading = summaryQuery.isLoading || chartQuery.isLoading;

//   const kpis = useMemo(() => {
//     if (!summaryQuery.data) return [];
//     const { projects, developers, payments } = summaryQuery.data;
//     return [
//       {
//         label: "Total Revenue",
//         value: Number(payments.total_revenue).toLocaleString("en-US", {
//           style: "currency",
//           currency: "USD",
//           maximumFractionDigits: 0,
//         }),
//         delta: "—",
//         trend: "neutral" as const,
//         description: "all-time billed",
//       },
//       {
//         label: "Active Users",
//         value: String(developers.total),
//         delta: developers.with_active_assignments
//           ? `${developers.with_active_assignments} assigned`
//           : undefined,
//         trend: "neutral" as const,
//         description: "developers",
//       },
//       {
//         label: "Projects",
//         value: String(projects.total),
//         delta: `${projects.active} active`,
//         trend: "neutral" as const,
//         description: `${projects.pending} pending`,
//       },
//       {
//         label: "Pending Payments",
//         value: Number(payments.pending_amount).toLocaleString("en-US", {
//           style: "currency",
//           currency: "USD",
//           maximumFractionDigits: 0,
//         }),
//         delta: undefined,
//         trend: "neutral" as const,
//         description: "awaiting collection",
//       },
//     ];
//   }, [summaryQuery.data]);

//   const chartData: ChartDataPoint[] = chartQuery.data ?? [];
//   const tableData: UserTableItem[] = useMemo(
//     () => (usersQuery.data ?? []).map(mapUserToTableItem),
//     [usersQuery.data]
//   );
//   const activityData = useMemo(
//     () => (activityQuery.data ?? []).map(mapNotificationToActivity),
//     [activityQuery.data]
//   );

//   const columns: ColumnDef<UserTableItem>[] = [
//     {
//       key: "name",
//       header: "User Name",
//       render: (item) => (
//         <div className="font-semibold text-slate-800 dark:text-slate-200">
//           {item.name}
//         </div>
//       ),
//     },
//     { key: "email", header: "Email Address" },
//     {
//       key: "role",
//       header: "Role",
//       render: (item) => (
//         <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
//           {item.role}
//         </span>
//       ),
//     },
//     {
//       key: "status",
//       header: "Status",
//       render: (item) => {
//         const styles: Record<string, string> = {
//           active:
//             "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40",
//           suspended:
//             "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40",
//           pending:
//             "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40",
//         };
//         return (
//           <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${styles[item.status]}`}>
//             {item.status.toUpperCase()}
//           </span>
//         );
//       },
//     },
//     { key: "createdAt", header: "Joined" },
//   ];

//   if (isLoading) {
//     return (
//       <div className="flex flex-col gap-6">
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//           {Array.from({ length: 4 }).map((_, i) => (
//             <KPICard key={i} label="Loading…" isLoading />
//           ))}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-col gap-6">
//       <div>
//         <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
//           Dashboard
//         </h1>
//         <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
//           Platform overview — revenue, users, and recent activity.
//         </p>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//         {kpis.map((kpi) => (
//           <KPICard key={kpi.label} {...kpi} />
//         ))}
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
//         <div className="lg:col-span-2 flex flex-col gap-6 w-full">
//           <MetricsChart data={chartData} title="Platform Analytics Overview" />
//           <DataTable
//             data={tableData}
//             columns={columns}
//             pageSize={5}
//             searchKey="name"
//             searchPlaceholder="Filter users by name…"
//           />
//         </div>
//         <div className="lg:col-span-1 h-full">
//           <ActivityFeed events={activityData} />
//         </div>
//       </div>
//     </div>
//   );
// }

// function DeveloperDashboardContent() {
//   const query = useMySelfReport();

//   if (query.isPending) {
//     return (
//       <div className="flex flex-col gap-6">
//         <div>
//           <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
//             Dashboard
//           </h1>
//           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
//             Loading your personalized metrics…
//           </p>
//         </div>
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {Array.from({ length: 3 }).map((_, i) => (
//             <KPICard key={i} label="Loading…" isLoading />
//           ))}
//         </div>
//       </div>
//     );
//   }

//   if (query.isError) {
//     return (
//       <ErrorState
//         message="We couldn't load your dashboard data."
//         onRetry={() => query.refetch()}
//       />
//     );
//   }

//   const data = query.data;

//   const kpis = [
//     {
//       label: "Projects Completed",
//       value: String(data.projects_completed),
//       description: "successfully finished",
//       trend: "neutral" as const,
//     },
//     {
//       label: "Pending Projects",
//       value: String(data.projects_pending),
//       description: "currently assigned / in progress",
//       trend: "neutral" as const,
//     },
//     {
//       label: "Total Earnings",
//       value: formatCurrency(data.earnings_from_completed_projects),
//       description: "from completed projects",
//       trend: "neutral" as const,
//     },
//   ];

//   return (
//     <div className="flex flex-col gap-6">
//       <div>
//         <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
//           Welcome back, {data.name}
//         </h1>
//         <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
//           Your personalized developer dashboard — project stats and module overview.
//         </p>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//         {kpis.map((kpi) => (
//           <KPICard key={kpi.label} {...kpi} />
//         ))}
//       </div>

//       <Card>
//         <CardHeader>
//           <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">
//             Assigned Modules
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           {data.modules.length === 0 ? (
//             <EmptyState
//               title="No assignments"
//               message="You don't have any active project modules assigned yet."
//             />
//           ) : (
//             <Table>
//               <TableHeader>
//                 <TableRow>
//                   <TableHead>Project / Module</TableHead>
//                   <TableHead>Status</TableHead>
//                   <TableHead>Progress</TableHead>
//                   <TableHead className="text-right">Share</TableHead>
//                   <TableHead className="text-right">Paid</TableHead>
//                   <TableHead className="text-right">Pending</TableHead>
//                 </TableRow>
//               </TableHeader>
//               <TableBody>
//                 {data.modules.map((m) => (
//                   <TableRow key={m.module_id}>
//                     <TableCell>
//                       <div className="font-semibold text-slate-800 dark:text-slate-200">
//                         {m.module_name}
//                       </div>
//                       <div className="text-xs text-slate-500">{m.project_name}</div>
//                     </TableCell>
//                     <TableCell>
//                       <StatusBadge status={m.status} />
//                     </TableCell>
//                     <TableCell className="w-40">
//                       <div className="flex items-center gap-2">
//                         <ProgressBar value={m.progress} className="h-2 w-full" />
//                         <span className="text-xs font-medium">{m.progress}%</span>
//                       </div>
//                     </TableCell>
//                     <TableCell className="text-right">
//                       {Number(m.share_percentage).toFixed(1)}%
//                     </TableCell>
//                     <TableCell className="text-right">{formatCurrency(m.amount_paid)}</TableCell>
//                     <TableCell className="text-right text-slate-500">
//                       {formatCurrency(m.amount_pending)}
//                     </TableCell>
//                   </TableRow>
//                 ))}
//               </TableBody>
//             </Table>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

// export function DashboardPage() {
//   const role = useSessionStore(selectRole);

//   if (role === "developer") {
//     return <DeveloperDashboardContent />;
//   }

//   return <DashboardContent />;
// }
