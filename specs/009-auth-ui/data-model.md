# Phase 1 Data Model — Authentication UI (009-auth-ui)

This slice has **no server-side data model changes** — it consumes the existing `users` and `auth` models from `002-auth-jwt-rbac`. The shapes below describe the *client-side* TypeScript types used by the auth module. They are pinned to the backend's OpenAPI (`specs/002-auth-jwt-rbac/contracts/openapi.yaml`) and to the Zod schemas in `frontend/src/modules/auth/schemas/`.

---

## 1. `Role`

A string-literal union mirroring the backend enum.

```ts
export const ROLES = ["admin", "manager", "developer"] as const;
export type Role = (typeof ROLES)[number];
```

- **Source of truth**: backend `UserCreate.role` enum.
- **Validation**: Zod `z.enum(ROLES)` in `register.schema.ts`.
- **Used by**: `RegisterForm`, `RequireRole`, `SessionState.user.role`, role-aware nav.

---

## 2. `User`

Sanitised user record — what the backend returns and what we hold in the session.

```ts
export type User = {
  id: number;
  name: string;
  email: string;          // lowercased, format: email
  role: Role;
  createdAt?: string;     // ISO; present on register, optional on /auth/me
};
```

- **Source of truth**: backend `UserRead` schema.
- **Field rules**:
  - `id` ≥ 1 (integer).
  - `name` non-empty, max 120 chars.
  - `email` valid email format; client lowercases before storage and comparison (spec FR-017).
  - `role` ∈ `ROLES`.
- **Forbidden**: no `password`, no `passwordHash`, no `accessToken` on this shape; those live elsewhere.

---

## 3. `TokenResponse`

What `POST /auth/login` returns; also what `POST /auth/register` returns when we elect to auto-sign-in (spec FR-003).

> **Note on register response**: the backend currently returns `UserRead` (201) without a token on register. The plan auto-signs-in by immediately calling `/auth/login` with the just-submitted credentials. This is captured in `contracts/auth-client.md` as the only "compound" service call.

```ts
export type TokenResponse = {
  accessToken: string;    // JWT, HS256, claims: sub, email, role, iat, exp
  tokenType: "bearer";
  user: User;
};
```

- **Source of truth**: backend `TokenResponse`. Wire field `access_token` is renamed to `accessToken` at the service boundary (`auth.api.ts`) to match TS-idiomatic camelCase; nothing else in the app touches the wire shape.

---

## 4. `LoginInput` / `RegisterInput`

Validated form payloads — TS types are derived from Zod schemas.

```ts
// schemas/login.schema.ts
export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

// schemas/register.schema.ts
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().trim().toLowerCase(),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "At least one letter")
    .regex(/\d/, "At least one digit"),
  role: z.enum(ROLES),
});
export type RegisterInput = z.infer<typeof registerSchema>;
```

- **Login** does not enforce password complexity on the client — the user might have a legacy password; the backend is the gate.
- **Register** mirrors the backend rules and adds the letter+digit client-side hint per the spec Assumptions.

---

## 5. `SessionState` (Zustand store)

The single source of client-side truth about the signed-in user.

```ts
export type SessionState = {
  // Persisted (localStorage via Zustand `persist`)
  accessToken: string | null;
  user: User | null;
  expiresAt: string | null;   // ISO; decoded from the JWT `exp` claim at set time

  // Transient (NOT persisted)
  hydrated: boolean;          // true after persist middleware finishes hydrating

  // Actions
  setSession(t: TokenResponse): void;
  clear(reason?: "user-initiated" | "session-ended" | "backend-rejected"): void;
  isExpired(now?: Date): boolean;
};
```

- **Storage key**: `progress-tracker.session`.
- **Persisted slice**: `{accessToken, user, expiresAt}` only. `hydrated` is set by an `onRehydrateStorage` callback.
- **Cross-tab sync**: a `storage` event listener (registered once at app bootstrap) re-reads the slice on change; if the slice is cleared, the store calls `clear({reason: "user-initiated"})`. This satisfies FR-020.
- **Invariants**:
  - `accessToken` and `user` are either both null or both set; the store rejects partial updates.
  - `expiresAt` is parsed from the JWT `exp` claim (seconds-since-epoch → ISO string) at `setSession` time; the JWT itself is never decoded elsewhere in the app.

---

## 6. Derived view models

These are pure functions, no state, included here so the contract is explicit.

```ts
export const selectIsAuthenticated = (s: SessionState): boolean =>
  s.accessToken !== null && !s.isExpired();

export const selectRole = (s: SessionState): Role | null =>
  s.user?.role ?? null;

export const selectCanAccess = (
  s: SessionState,
  allowed: readonly Role[],
): boolean => {
  const role = selectRole(s);
  return role !== null && allowed.includes(role);
};
```

`<RequireAuth>` calls `selectIsAuthenticated`. `<RequireRole>` calls `selectCanAccess`. Role-aware navigation calls `selectRole` and renders entries declaratively.

---

## 7. Lifecycle (state transitions)

```text
                  ┌────────────────────────────────────────┐
                  │              UNAUTHENTICATED            │
                  │  accessToken=null, user=null, exp=null  │
                  └─────────────────┬──────────────────────┘
                                    │ useLogin / useRegister success
                                    ▼
                  ┌────────────────────────────────────────┐
                  │              AUTHENTICATED              │
                  │  accessToken=<jwt>, user=<User>,        │
                  │  expiresAt=<future ISO>                 │
                  └─┬──────────┬─────────────────┬─────────┘
                    │          │                 │
   user clicks ──── │          │ /auth/me 401    │ JWT exp < now (client check)
   sign-out         │          │ (backend reject)│
                    ▼          ▼                 ▼
            clear("user-   clear("backend-   clear("session-
             initiated")    rejected")        ended")
                    │          │                 │
                    └──────────┴─────────────────┘
                                    │
                                    ▼
                  ┌────────────────────────────────────────┐
                  │              UNAUTHENTICATED            │
                  └────────────────────────────────────────┘
```

- All three "clear" reasons land in the same UNAUTHENTICATED state; only the user-facing notice differs (`/login` reads the reason from a transient slot and renders the appropriate banner).
- Re-entry into AUTHENTICATED is always via a fresh `useLogin` or `useRegister` mutation — there is no client-side token-refresh path in this slice.

---

## 8. Backend response → client model mapping

| Backend (wire) | Client (TS) | Notes |
|----------------|-------------|-------|
| `access_token` | `accessToken` | renamed at the service boundary |
| `token_type` | `tokenType` | renamed; value pinned to `"bearer"` |
| `user.created_at` | `user.createdAt` | renamed; optional |
| `detail: "Could not validate credentials"` | thrown as `AuthError("invalid-credentials")` | login generic 401 |
| `detail: "Email already registered"` | thrown as `AuthError("email-in-use")` | register 409 → attached to `email` field |
| `detail: "Forbidden"` | thrown as `AuthError("forbidden")` | 403 from any guard |
| `HTTPValidationError` (422) | mapped to per-field RHF errors keyed on `loc[1]` | server-side field errors |

The mapping lives in `auth.api.ts`; tests in `tests/unit/http.interceptor.test.ts` lock it down.
