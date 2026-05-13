import { AxiosError } from "axios";
import { http } from "@/lib/http";
import {
  UsersApiError,
  type EditDraft,
  type User,
  type UsersApiErrorCode,
  type Role,
} from "@/modules/users/types";

type UserWire = {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  developer?: DeveloperWire | null;
};

type DeveloperWire = {
  hourly_rate?: number | null;
  capacity_hours_per_week?: number | null;
  [key: string]: unknown;
};

type UpdateUserBodyWire = {
  name?: string;
  role?: Role;
};

type UpdateStatusBodyWire = {
  is_active: boolean;
};

type ValidationDetail = { loc: (string | number)[]; msg: string; type: string };

function fromWire(w: UserWire): User {
  return {
    id: w.id,
    name: w.name,
    email: w.email,
    role: w.role,
    isActive: w.is_active,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    developer: w.developer
      ? {
          hourlyRate: w.developer.hourly_rate ?? null,
          capacityHoursPerWeek: w.developer.capacity_hours_per_week ?? null,
        }
      : null,
  };
}

function toUpdateBody(draft: EditDraft): UpdateUserBodyWire {
  const body: UpdateUserBodyWire = {};
  if (draft.name !== undefined) body.name = draft.name;
  if (draft.role !== undefined) body.role = draft.role;
  return body;
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

    let code: UsersApiErrorCode;
    let message: string;
    let fieldErrors: Record<string, string> | undefined;

    switch (status) {
      case 401:
        code = "unauthorized";
        message = "Session expired";
        break;
      case 403:
        code = "forbidden";
        message = detailText ?? "You don't have permission to view this resource";
        break;
      case 404:
        code = "not_found";
        message = detailText ?? "User not found";
        break;
      case 409:
        code = "conflict";
        message = detailText ?? "This change conflicts with the current state";
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
    throw new UsersApiError(code, message, { status: status ?? 0, detail: detailText, fieldErrors });
  }
  throw new UsersApiError("unknown", "Unexpected error");
}

async function list(): Promise<User[]> {
  try {
    const res = await http.get<UserWire[]>("/users");
    return res.data.map(fromWire);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function get(id: number): Promise<User> {
  try {
    const res = await http.get<UserWire>(`/users/${id}`);
    return fromWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function update(id: number, draft: EditDraft): Promise<User> {
  try {
    const hasNameOrRole = draft.name !== undefined || draft.role !== undefined;
    const hasStatus = draft.isActive !== undefined;
    let latest: User | null = null;

    if (hasNameOrRole) {
      const res = await http.patch<UserWire>(`/users/${id}`, toUpdateBody(draft));
      latest = fromWire(res.data);
    }
    if (hasStatus) {
      const body: UpdateStatusBodyWire = { is_active: draft.isActive as boolean };
      const res = await http.patch<UserWire>(`/users/${id}/status`, body);
      latest = fromWire(res.data);
    }
    if (latest === null) {
      // No-op draft — re-read the current value.
      latest = await get(id);
    }
    return latest;
  } catch (err) {
    mapAxiosError(err);
  }
}

async function updateStatus(id: number, isActive: boolean): Promise<User> {
  try {
    const res = await http.patch<UserWire>(`/users/${id}/status`, { is_active: isActive });
    return fromWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

export const usersApi = {
  list,
  get,
  update,
  updateStatus,
};

export const USERS_QUERY_KEYS = {
  list: () => ["users", "list"] as const,
  detail: (id: number) => ["users", "detail", id] as const,
};
