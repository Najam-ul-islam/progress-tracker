export type ProjectStatus = "pending" | "active" | "completed";
export type ModuleStatus = "pending" | "in_progress" | "completed";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  clientId: number;
  assignedDeveloperId: number | null;
  totalAmount: string; // Decimal from backend
  companyShare: number;
  developerShare: number;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  status: ProjectStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectModule {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  assignedDeveloperId: number;
  progress: number; // 0-100
  status: ModuleStatus;
  sharePercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleCreateBodyWire {
  name: string;
  description: string | null;
  assignedDeveloperId: number;
  sharePercentage: number;
}

export interface ProjectProgress {
  projectId: number;
  progress: number;
  modules: {
    id: number;
    name: string;
    progress: number;
    sharePercentage: number;
    assignedDeveloperId: number;
  }[];
}

export type ProjectsApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "network"
  | "unknown";

export class ProjectsApiError extends Error {
  readonly status: number;
  readonly code: ProjectsApiErrorCode;
  readonly detail?: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: ProjectsApiErrorCode,
    message: string,
    opts?: { status?: number; detail?: string; fieldErrors?: Record<string, string> }
  ) {
    super(message);
    this.name = "ProjectsApiError";
    this.code = code;
    this.status = opts?.status ?? 0;
    this.detail = opts?.detail;
    this.fieldErrors = opts?.fieldErrors;
  }
}
