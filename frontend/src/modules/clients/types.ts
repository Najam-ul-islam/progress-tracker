export type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// Pending change set for an edit — only the fields the operator touched.
// `null` clears a previously-set optional; omitted fields are left unchanged.
export type ClientDraft = Partial<{
  name: string;
  email: string;
  phone: string;
  companyName: string | null;
  address: string | null;
  notes: string | null;
}>;

export type ClientsApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "network"
  | "unknown";

export class ClientsApiError extends Error {
  readonly status: number;
  readonly code: ClientsApiErrorCode;
  readonly detail?: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: ClientsApiErrorCode,
    message: string,
    opts?: { status?: number; detail?: string; fieldErrors?: Record<string, string> }
  ) {
    super(message);
    this.name = "ClientsApiError";
    this.code = code;
    this.status = opts?.status ?? 0;
    this.detail = opts?.detail;
    this.fieldErrors = opts?.fieldErrors;
  }
}
