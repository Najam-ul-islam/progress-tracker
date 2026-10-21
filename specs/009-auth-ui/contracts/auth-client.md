# Internal Contract — Auth Client API (frontend)

**Module**: `frontend/src/modules/auth/services/auth.api.ts`
**Consumed by**: `useLogin`, `useRegister`, `useMe`, `useLogout` (in `modules/auth/hooks/`), and indirectly by guards and pages.

This is an **internal TypeScript contract**, not an HTTP contract. It pins the function signatures every other client-side caller will import, so changing them is a cross-cutting concern.

---

## 1. Functions

```ts
import type { LoginInput, RegisterInput, TokenResponse, User } from "../types";

export async function login(input: LoginInput): Promise<TokenResponse>;

export async function register(input: RegisterInput): Promise<TokenResponse>;
  // Compound: POSTs /auth/register, then POSTs /auth/login with the same email+password.
  // Returns the TokenResponse from the login call. Failure of either step throws.

export async function fetchCurrentUser(): Promise<User>;
  // GET /auth/me using the bearer token attached by the Axios interceptor.
```

All three functions throw `AuthError` (see below) on documented failure modes and let unexpected errors (network, 5xx) bubble as `AxiosError` for React Query's default retry semantics to handle.

---

## 2. Error class

```ts
export type AuthErrorKind =
  | "invalid-credentials"   // login 401
  | "email-in-use"          // register 409
  | "forbidden"             // 403 from any endpoint
  | "validation"            // 422 — carries field-level details
  | "session-ended";        // synthesised when interceptor sees 401 on a non-login call

export class AuthError extends Error {
  readonly kind: AuthErrorKind;
  readonly fieldErrors?: Record<string, string>; // populated when kind === "validation"
  constructor(kind: AuthErrorKind, message: string, fieldErrors?: Record<string, string>);
}
```

- Components catch `AuthError` and route it: top-level alert for `invalid-credentials` / `session-ended`, field-level via `setError` for `email-in-use` / `validation`.
- `forbidden` is rare from the auth endpoints themselves (it comes from RBAC-gated endpoints in other modules) but is included here because the same error class is used app-wide.

---

## 3. Side effects (must not leak elsewhere)

- `auth.api.ts` MUST NOT touch the Zustand store directly; it returns plain values. Mutating the session is the job of the hooks (`useLogin` → `sessionStore.setSession(...)` on success).
- `auth.api.ts` MUST NOT call `useNavigate` or anything from `react-router-dom`. Navigation is a hook/page concern.
- `auth.api.ts` MUST use the shared Axios instance from `src/lib/http.ts`; it MUST NOT create its own.

These rules keep the service layer pure and testable in isolation (see `tests/unit/http.interceptor.test.ts` and the component tests under MSW).

---

## 4. Hook signatures (consumers of the service)

```ts
// useLogin
const m = useLogin(); // UseMutationResult<TokenResponse, AuthError, LoginInput>
await m.mutateAsync({email, password});  // on success the store is set; on failure m.error is AuthError

// useRegister
const m = useRegister();
await m.mutateAsync({name, email, password, role});

// useMe
const q = useMe(); // UseQueryResult<User, AuthError> — staleTime 60s, refetchOnWindowFocus true

// useLogout
const logout = useLogout(); // () => void — clears store, invalidates queries, navigates to /login
```

Every component that needs auth uses **only** these hooks. No component imports from `auth.api.ts` directly. This is what makes the constitution's "no API calls inside UI components" rule trivially auditable: a grep for `auth.api` outside `hooks/` is the lint.

---

## 5. Wire-shape adaptation

`auth.api.ts` is the **only** place that touches snake_case wire fields. It renames:

| Wire | TS |
|------|----|
| `access_token` | `accessToken` |
| `token_type` | `tokenType` |
| `user.created_at` | `user.createdAt` |

Renaming is done with a small `toTokenResponse(raw)` mapper rather than ad-hoc destructuring at each call site, so the surface for backend field changes is one function.
