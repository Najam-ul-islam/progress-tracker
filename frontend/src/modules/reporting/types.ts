// Read-only view models mirroring the backend 007-reporting response schemas
// (specs/007-reporting/contracts/reporting.openapi.yaml). Monetary and average
// fields are DECIMAL STRINGS — format for display via lib/format.ts; never do
// float arithmetic on them.

export type ProjectStatus = "pending" | "active" | "completed";
export type ModuleStatus = "pending" | "in_progress" | "completed";

export interface ChartDataPoint {
  name: string;
  revenue: number;
  expenses: number;
  users: number;
}

export interface ChartDataResponse {
  items: ChartDataPoint[];
}

// --- /reports/dashboard ----------------------------------------------------

export interface DashboardSummary {
  projects: {
    total: number;
    pending: number;
    active: number;
    completed: number;
    overdue: number;
  };
  developers: {
    total: number;
    with_active_assignments: number;
    average_module_progress: string; // decimal string, 1 dp
  };
  payments: {
    total_revenue: string;
    total_company_reserve: string;
    total_developer_disbursed: string;
    pending_amount: string;
    unbilled_revenue: string;
  };
}

// --- /reports/projects -----------------------------------------------------

export interface ProjectReportModule {
  id: number;
  name: string;
  assigned_developer_id: number;
  assigned_developer_name: string;
  progress: number; // 0-100
  status: ModuleStatus;
  share_percentage: string;
}

export interface ProjectReportRow {
  id: number;
  name: string;
  client_id: number;
  client_name: string;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  overall_progress: number; // 0-100
  module_count: number;
  modules_completed: number;
  modules_in_progress: number;
  modules_pending: number;
  invoiced_amount: string;
  outstanding_amount: string;
  modules: ProjectReportModule[];
}

// --- /reports/developers ---------------------------------------------------

export interface EarningsBlock {
  paid: string;
  pending: string;
  total: string;
}

export interface EarningsByProject {
  project_id: number;
  project_name: string;
  paid: string;
  pending: string;
  total: string;
}

export interface DeveloperReportRow {
  id: number;
  name: string;
  email: string;
  module_count: number;
  modules_completed: number;
  modules_in_progress: number;
  modules_pending: number;
  earnings: EarningsBlock;
  earnings_by_project: EarningsByProject[];
}

// --- /reports/payments -----------------------------------------------------

export interface FinancialReportRow {
  project_id: number;
  project_name: string;
  client_id: number;
  client_name: string;
  status: ProjectStatus;
  invoiced: string;
  company_share: string;
  developer_share: string;
  outstanding: string;
  payment_count: number;
}

export interface FinancialTotals {
  invoiced: string;
  company_share: string;
  developer_share: string;
  outstanding: string;
}

export interface FinancialReportResponse {
  rows: FinancialReportRow[];
  totals: FinancialTotals;
}
