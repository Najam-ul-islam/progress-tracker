import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

export type ClientSeed = {
  id: number;
  name: string;
  email: string;
  phone: string;
  company_name?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export const seededClients: ClientSeed[] = [
  {
    id: 1,
    name: "Acme Corp",
    email: "contact@acme.example.com",
    phone: "+1 415 555 0101",
    company_name: "Acme Corporation",
    address: "1 Market St, San Francisco, CA",
    notes: "Flagship client.",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Beth Boran",
    email: "beth@boran.example.com",
    phone: "+44 20 7946 0102",
    company_name: null,
    address: null,
    notes: null,
    created_at: "2026-02-02T00:00:00Z",
    updated_at: "2026-02-02T00:00:00Z",
  },
  {
    id: 3,
    name: "Globex",
    email: "hello@globex.example.com",
    phone: "+1 212 555 0103",
    company_name: "Globex Inc",
    address: "5th Avenue, New York, NY",
    notes: null,
    created_at: "2026-02-03T00:00:00Z",
    updated_at: "2026-02-03T00:00:00Z",
  },
];

function normalize(c: ClientSeed) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company_name: c.company_name ?? null,
    address: c.address ?? null,
    notes: c.notes ?? null,
    is_active: c.is_active ?? true,
    created_at: c.created_at ?? "2026-02-01T00:00:00Z",
    updated_at: c.updated_at ?? "2026-02-01T00:00:00Z",
  };
}

// ---- Success / happy-path handlers (default) -------------------------------

export const clientsListSuccess = (clients: ClientSeed[] = seededClients) =>
  http.get(`${BASE}/clients`, () => HttpResponse.json(clients.map(normalize)));

export const clientGetSuccess = (client: ClientSeed) =>
  http.get(`${BASE}/clients/:id`, ({ params }) => {
    if (String(params.id) === String(client.id)) {
      return HttpResponse.json(normalize(client));
    }
    return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
  });

export const clientCreateSuccess = (created?: Partial<ClientSeed>) =>
  http.post(`${BASE}/clients`, async ({ request }) => {
    const body = (await request.json()) as Partial<ClientSeed>;
    return HttpResponse.json(
      normalize({ id: 99, name: "", email: "", phone: "", ...body, ...created }),
      { status: 201 }
    );
  });

export const clientUpdateSuccess = (base: ClientSeed) =>
  http.patch(`${BASE}/clients/:id`, async ({ request }) => {
    const body = (await request.json()) as Partial<ClientSeed>;
    return HttpResponse.json(normalize({ ...base, ...body }));
  });

export const clientDeleteSuccess = () =>
  http.delete(`${BASE}/clients/:id`, () => new HttpResponse(null, { status: 204 }));

// ---- Error handlers (opt-in via server.use) --------------------------------

export const clientsListForbidden = () =>
  http.get(`${BASE}/clients`, () =>
    HttpResponse.json({ detail: "Forbidden" }, { status: 403 })
  );

export const clientsListUnauthorized = () =>
  http.get(`${BASE}/clients`, () =>
    HttpResponse.json({ detail: "Could not validate credentials" }, { status: 401 })
  );

export const clientsListNetworkError = () =>
  http.get(`${BASE}/clients`, () => HttpResponse.error());

export const clientGetForbidden = () =>
  http.get(`${BASE}/clients/:id`, () =>
    HttpResponse.json({ detail: "Forbidden" }, { status: 403 })
  );

export const clientGetNotFound = () =>
  http.get(`${BASE}/clients/:id`, () =>
    HttpResponse.json({ detail: "Client not found" }, { status: 404 })
  );

export const clientCreateConflict = (field: "email" | "phone" = "email") =>
  http.post(`${BASE}/clients`, () =>
    HttpResponse.json(
      { detail: `client with this ${field} already exists` },
      { status: 409 }
    )
  );

export const clientCreateValidation = (
  fieldErrors: Record<string, string> = { email: "value is not a valid email address" }
) =>
  http.post(`${BASE}/clients`, () =>
    HttpResponse.json(
      {
        detail: Object.entries(fieldErrors).map(([k, msg]) => ({
          loc: ["body", k],
          msg,
          type: "value_error",
        })),
      },
      { status: 422 }
    )
  );

export const clientCreateNetworkError = () =>
  http.post(`${BASE}/clients`, () => HttpResponse.error());

export const clientUpdateConflict = (field: "email" | "phone" = "email") =>
  http.patch(`${BASE}/clients/:id`, () =>
    HttpResponse.json(
      { detail: `client with this ${field} already exists` },
      { status: 409 }
    )
  );

export const clientUpdateNetworkError = () =>
  http.patch(`${BASE}/clients/:id`, () => HttpResponse.error());

export const clientDeleteForbidden = () =>
  http.delete(`${BASE}/clients/:id`, () =>
    HttpResponse.json({ detail: "Forbidden" }, { status: 403 })
  );

export const clientDeleteNetworkError = () =>
  http.delete(`${BASE}/clients/:id`, () => HttpResponse.error());

export const defaultClientsHandlers = [
  clientsListSuccess(),
  clientGetSuccess(seededClients[0]),
  clientCreateSuccess(),
  clientUpdateSuccess(seededClients[0]),
  clientDeleteSuccess(),
];
