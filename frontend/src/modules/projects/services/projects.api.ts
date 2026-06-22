import { AxiosError } from "axios";
import { http } from "@/lib/http";
import {
  ProjectsApiError,
  type Project,
  type ProjectModule,
  type ProjectProgress,
  type ProjectsApiErrorCode,
} from "@/modules/projects/types";

// Wire types (snake_case from backend)
type ProjectWire = {
  id: number;
  name: string;
  description: string | null;
  client_id: number;
  assigned_developer_id: number | null;
  total_amount: string;
  company_share: number;
  developer_share: number;
  start_date: string;
  end_date: string;
  status: Project["status"];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ModuleWire = {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  assigned_developer_id: number;
  progress: number;
  status: ProjectModule["status"];
  share_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ProgressWire = {
  project_id: number;
  progress: number;
  modules: {
    id: number;
    name: string;
    progress: number;
    share_percentage: number | string;
    assigned_developer_id: number;
  }[];
};

export type ProjectCreateBodyWire = {
  name: string;
  description?: string;
  client_id: number;
  assigned_developer_id?: number;
  total_amount: string;
  start_date: string;
  end_date: string;
};

export type ModuleCreateBodyWire = {
  name: string;
  description?: string;
  assigned_developer_id: number;
  share_percentage: number;
};

type ValidationDetail = { loc: (string | number)[]; msg: string; type: string };

function fromProjectWire(w: ProjectWire): Project {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    clientId: w.client_id,
    assignedDeveloperId: w.assigned_developer_id,
    totalAmount: w.total_amount,
    companyShare: w.company_share,
    developerShare: w.developer_share,
    startDate: w.start_date,
    endDate: w.end_date,
    status: w.status,
    isActive: w.is_active,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

function fromModuleWire(w: ModuleWire): ProjectModule {
  return {
    id: w.id,
    projectId: w.project_id,
    name: w.name,
    description: w.description,
    assignedDeveloperId: w.assigned_developer_id,
    progress: w.progress,
    status: w.status,
    sharePercentage: w.share_percentage,
    isActive: w.is_active,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

function fromProgressWire(w: ProgressWire): ProjectProgress {
  return {
    projectId: w.project_id,
    progress: w.progress,
    modules: w.modules.map(m => ({
      id: m.id,
      name: m.name,
      progress: m.progress,
      sharePercentage: typeof m.share_percentage === "string" ? parseFloat(m.share_percentage) : m.share_percentage,
      assignedDeveloperId: m.assigned_developer_id,
    })),
  };
}

function fieldErrorsFromValidation(detail: ValidationDetail[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of detail) {
    const key = typeof d.loc[1] === "string" ? d.loc[1] : String(d.loc[d.loc.length - 1] ?? "form");
    if (!(key in out)) out[key] = d.msg;
  }
  return out;
}

function mapAxiosError(err: unknown): never {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data as { detail?: unknown } | undefined;
    const detailText = typeof data?.detail === "string" ? data.detail : undefined;

    let code: ProjectsApiErrorCode;
    let message: string;
    let fieldErrors: Record<string, string> | undefined;

    switch (status) {
      case 401:
        code = "unauthorized";
        message = "Session expired";
        break;
      case 403:
        code = "forbidden";
        message = detailText ?? "You don't have permission to access projects";
        break;
      case 404:
        code = "not_found";
        message = detailText ?? "Project or module not found";
        break;
      case 409:
        code = "conflict";
        message = detailText ?? "Conflict detected";
        break;
      case 400:
      case 422:
        code = "validation";
        message = detailText ?? "Validation failed";
        if (Array.isArray(data?.detail)) {
          fieldErrors = fieldErrorsFromValidation(data.detail as ValidationDetail[]);
        }
        break;
      default:
        if (err.code === "ERR_NETWORK" || !err.response) {
          code = "network";
          message = "Can't reach the server. Please try again.";
        } else {
          code = "unknown";
          message = detailText ?? "Something went wrong";
        }
    }
    throw new ProjectsApiError(code, message, { status: status ?? 0, detail: detailText, fieldErrors });
  }
  throw new ProjectsApiError("unknown", "Unexpected error");
}

async function list(): Promise<Project[]> {
  try {
    const res = await http.get<ProjectWire[]>("/projects");
    return res.data.map(fromProjectWire);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function get(id: number): Promise<Project> {
  try {
    const res = await http.get<ProjectWire>(`/projects/${id}`);
    return fromProjectWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function create(body: ProjectCreateBodyWire): Promise<Project> {
  try {
    const res = await http.post<ProjectWire>("/projects", body);
    return fromProjectWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function update(id: number, body: Partial<ProjectWire>): Promise<Project> {
  try {
    const res = await http.patch<ProjectWire>(`/projects/${id}`, body);
    return fromProjectWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function addModule(projectId: number, body: ModuleCreateBodyWire): Promise<ProjectModule> {
  try {
    const res = await http.post<ModuleWire>(`/projects/${projectId}/modules`, body);
    return fromModuleWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function updateModuleProgress(id: number, progress: number): Promise<ProjectModule> {
  try {
    const res = await http.patch<ModuleWire>(`/modules/${id}/progress`, { progress });
    return fromModuleWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function getProgress(id: number): Promise<ProjectProgress> {
  try {
    const res = await http.get<ProgressWire>(`/projects/${id}/progress`);
    return fromProgressWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function remove(id: number): Promise<void> {
  try {
    await http.delete(`/projects/${id}`);
  } catch (err) {
    mapAxiosError(err);
  }
}

export const projectsApi = {
  list,
  get,
  create,
  update,
  addModule,
  updateModuleProgress,
  getProgress,
  remove,
};

export const PROJECTS_QUERY_KEYS = {
  list: () => ["projects", "list"] as const,
  detail: (id: number) => ["projects", "detail", id] as const,
  progress: (id: number) => ["projects", "progress", id] as const,
};
