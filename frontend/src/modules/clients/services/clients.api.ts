import { AxiosError } from "axios";
import { http } from "@/lib/http";
import {
  ClientsApiError,
  type Client,
  type ClientDraft,
  type ClientsApiErrorCode,
} from "@/modules/clients/types";

type ClientWire = {
  id: number;
  name: string;
  email: string;
  phone: string;
  company_name: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientCreateBodyWire = {
  name: string;
  email: string;
  phone: string;
  company_name?: string | null;
  address?: string | null;
  notes?: string | null;
};

type ClientUpdateBodyWire = Partial<ClientCreateBodyWire>;

type ValidationDetail = { loc: (string | number)[]; msg: string; type: string };

function fromWire(w: ClientWire): Client {
  return {
    id: w.id,
    name: w.name,
    email: w.email,
    phone: w.phone,
    companyName: w.company_name ?? null,
    address: w.address ?? null,
    notes: w.notes ?? null,
    isActive: w.is_active,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

// Full create body: required trio always present; empty optionals omitted.
export function toCreateBody(values: {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  address: string;
  notes: string;
}): ClientCreateBodyWire {
  const body: ClientCreateBodyWire = {
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
  };
  if (values.companyName.trim()) body.company_name = values.companyName.trim();
  if (values.address.trim()) body.address = values.address.trim();
  if (values.notes.trim()) body.notes = values.notes.trim();
  return body;
}

// Patch body: only changed fields. Maps camelCase draft → snake_case wire.
function toUpdateBody(draft: ClientDraft): ClientUpdateBodyWire {
  const body: ClientUpdateBodyWire = {};
  if (draft.name !== undefined) body.name = draft.name;
  if (draft.email !== undefined) body.email = draft.email;
  if (draft.phone !== undefined) body.phone = draft.phone;
  if (draft.companyName !== undefined) body.company_name = draft.companyName;
  if (draft.address !== undefined) body.address = draft.address;
  if (draft.notes !== undefined) body.notes = draft.notes;
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

    let code: ClientsApiErrorCode;
    let message: string;
    let fieldErrors: Record<string, string> | undefined;

    switch (status) {
      case 401:
        code = "unauthorized";
        message = "Session expired";
        break;
      case 403:
        code = "forbidden";
        message = detailText ?? "You don't have permission to access clients";
        break;
      case 404:
        code = "not_found";
        message = detailText ?? "Client not found";
        break;
      case 409:
        code = "conflict";
        message = detailText ?? "This change conflicts with an existing client";
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
    throw new ClientsApiError(code, message, { status: status ?? 0, detail: detailText, fieldErrors });
  }
  throw new ClientsApiError("unknown", "Unexpected error");
}

async function list(): Promise<Client[]> {
  try {
    const res = await http.get<ClientWire[]>("/clients");
    return res.data.map(fromWire);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function get(id: number): Promise<Client> {
  try {
    const res = await http.get<ClientWire>(`/clients/${id}`);
    return fromWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function create(body: ClientCreateBodyWire): Promise<Client> {
  try {
    const res = await http.post<ClientWire>("/clients", body);
    return fromWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function update(id: number, draft: ClientDraft): Promise<Client> {
  try {
    const res = await http.patch<ClientWire>(`/clients/${id}`, toUpdateBody(draft));
    return fromWire(res.data);
  } catch (err) {
    mapAxiosError(err);
  }
}

async function remove(id: number): Promise<void> {
  try {
    await http.delete(`/clients/${id}`);
  } catch (err) {
    mapAxiosError(err);
  }
}

export const clientsApi = {
  list,
  get,
  create,
  update,
  remove,
};

export const CLIENTS_QUERY_KEYS = {
  list: () => ["clients", "list"] as const,
  detail: (id: number) => ["clients", "detail", id] as const,
};
