import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

export type UserSeed = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "developer";
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export const seededUsers: UserSeed[] = [
  {
    id: 1,
    name: "Ada Admin",
    email: "ada@example.com",
    role: "admin",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Maya Manager",
    email: "maya@example.com",
    role: "manager",
    is_active: true,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  {
    id: 3,
    name: "Dev Devon",
    email: "devon@example.com",
    role: "developer",
    is_active: true,
    created_at: "2026-01-03T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
  },
  {
    id: 4,
    name: "Inactive Ian",
    email: "ian@example.com",
    role: "developer",
    is_active: false,
    created_at: "2026-01-04T00:00:00Z",
    updated_at: "2026-01-04T00:00:00Z",
  },
];

function normalize(u: UserSeed) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    is_active: u.is_active ?? true,
    created_at: u.created_at ?? "2026-01-01T00:00:00Z",
    updated_at: u.updated_at ?? "2026-01-01T00:00:00Z",
  };
}

export const usersListSuccess = (users: UserSeed[] = seededUsers) =>
  http.get(`${BASE}/users`, () => HttpResponse.json(users.map(normalize)));

export const usersListForbidden = () =>
  http.get(`${BASE}/users`, () =>
    HttpResponse.json({ detail: "Not authorized" }, { status: 403 })
  );

export const usersListUnauthorized = () =>
  http.get(`${BASE}/users`, () =>
    HttpResponse.json({ detail: "Could not validate credentials" }, { status: 401 })
  );

export const usersListNetworkError = () =>
  http.get(`${BASE}/users`, () => HttpResponse.error());

export const userGetSuccess = (user: UserSeed) =>
  http.get(`${BASE}/users/:id`, ({ params }) => {
    if (String(params.id) === String(user.id)) {
      return HttpResponse.json(normalize(user));
    }
    return HttpResponse.json({ detail: "User not found" }, { status: 404 });
  });

export const userGetForbidden = () =>
  http.get(`${BASE}/users/:id`, () =>
    HttpResponse.json({ detail: "Not authorized" }, { status: 403 })
  );

export const userGetNotFound = () =>
  http.get(`${BASE}/users/:id`, () =>
    HttpResponse.json({ detail: "User not found" }, { status: 404 })
  );

export const userUpdateSuccess = (updated: UserSeed) =>
  http.patch(`${BASE}/users/:id`, async ({ request }) => {
    const body = (await request.json()) as { name?: string; role?: UserSeed["role"] };
    return HttpResponse.json(
      normalize({ ...updated, ...(body.name !== undefined ? { name: body.name } : {}), ...(body.role !== undefined ? { role: body.role } : {}) })
    );
  });

export const userUpdateValidation = (fieldErrors: Record<string, string> = { name: "required" }) =>
  http.patch(`${BASE}/users/:id`, () =>
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

export const userUpdateConflict = (detail = "Cannot deactivate yourself") =>
  http.patch(`${BASE}/users/:id`, () =>
    HttpResponse.json({ detail }, { status: 409 })
  );

export const userUpdateNotFound = () =>
  http.patch(`${BASE}/users/:id`, () =>
    HttpResponse.json({ detail: "User not found" }, { status: 404 })
  );

export const userStatusSuccess = (updated: UserSeed) =>
  http.patch(`${BASE}/users/:id/status`, async ({ request }) => {
    const body = (await request.json()) as { is_active: boolean };
    return HttpResponse.json(normalize({ ...updated, is_active: body.is_active }));
  });

export const userStatusConflict = (detail = "Cannot deactivate yourself") =>
  http.patch(`${BASE}/users/:id/status`, () =>
    HttpResponse.json({ detail }, { status: 409 })
  );

export const defaultUsersHandlers = [
  usersListSuccess(),
  userGetSuccess(seededUsers[0]),
  userUpdateSuccess(seededUsers[0]),
  userStatusSuccess(seededUsers[0]),
];
