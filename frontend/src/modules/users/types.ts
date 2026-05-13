import type { Role } from "@/modules/auth/types";

export type { Role };
export type Status = "active" | "inactive";

export type DeveloperMetadata = {
  hourlyRate?: number | null;
  capacityHoursPerWeek?: number | null;
  [key: string]: unknown;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  developer?: DeveloperMetadata | null;
};

export type UsersFilter = {
  q: string;
  role: Role | "any";
  status: Status | "all";
};

export type EditDraft = Partial<Pick<User, "name" | "role" | "isActive">>;

export type UsersApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "network"
  | "unknown";

export class UsersApiError extends Error {
  readonly status: number;
  readonly code: UsersApiErrorCode;
  readonly detail?: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: UsersApiErrorCode,
    message: string,
    opts?: { status?: number; detail?: string; fieldErrors?: Record<string, string> }
  ) {
    super(message);
    this.name = "UsersApiError";
    this.code = code;
    this.status = opts?.status ?? 0;
    this.detail = opts?.detail;
    this.fieldErrors = opts?.fieldErrors;
  }
}
