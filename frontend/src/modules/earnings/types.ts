export type ModuleStatus = "pending" | "in_progress" | "completed";

// Monetary fields are decimal strings from the backend — format via lib/format.ts.
export interface EarningsBlock {
  paid: string;
  pending: string;
  total: string;
}

export interface DeveloperSelfModule {
  module_id: number;
  module_name: string;
  project_id: number;
  project_name: string;
  progress: number;
  status: ModuleStatus;
  share_percentage: string;
  amount_paid: string;
  amount_pending: string;
}

export interface DeveloperSelfReport {
  id: number;
  name: string;
  module_count: number;
  modules_completed: number;
  modules_in_progress: number;
  modules_pending: number;
  earnings: EarningsBlock;
  modules: DeveloperSelfModule[];
  projects_completed: number;
  projects_pending: number;
  earnings_from_completed_projects: string;
}
