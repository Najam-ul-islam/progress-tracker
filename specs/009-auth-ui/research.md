# Phase 0 Research — Authentication UI (009-auth-ui)

This document resolves the technical unknowns that arise from the spec and the constitution, before any code is written. Each item follows: **Decision / Rationale / Alternatives considered**.

---

## 1. Router

**Decision**: `react-router-dom` v7, using `createBrowserRouter` + `<RouterProvider>`, a single `routes.tsx` declaring the tree.

**Rationale**:
- The constitution names "Protected routes required" and "Role-aware navigation" but is router-agnostic; `react-router-dom` is the de-facto choice for React SPAs and has first-class loaders/actions if later features want them.
- v7's data-router API supports `loader`-based pre-render auth checks, which lets the guards run *before* the page paints (eliminates the protected-content flicker called out in SC-007).
- Matches the existing community examples for shadcn/ui + RHF + RQ that we'll lean on for primitives.

**Alternatives considered**:
- TanStack Router: more type-safe routing, but adds a second TanStack package and a learning step for the team; no compelling win for a 4-route slice.
- Hand-rolled `window.location` routing: cheap now, expensive in two features' time when nested routing arrives.

---

## 2. HTTP client and 401 handling

**Decision**: A single Axios instance in `src/lib/http.ts` with:
- A request interceptor that reads the access token from the Zustand store and attaches `Authorization: Bearer <token>` when present.
- A response interceptor that, on `401`, calls `sessionStore.clear({reason: "session-ended"})` and emits a one-shot toast/banner before letting the rejection propagate, so the guard re-render carries the user to `/login` with the "session ended" notice (FR-013).
- `baseURL` from `import.meta.env.VITE_API_BASE_URL` (defaults to `http://localhost:8000` in dev).

**Rationale**:
- Constitution mandates Axios.
- Centralising 401 handling in one interceptor avoids each hook re-implementing it, and keeps the "no API calls in UI components" rule clean.
- Using the store inside the interceptor (via `sessionStore.getState()` — Zustand allows non-hook access) is the canonical pattern and avoids React-tree coupling.

**Alternatives considered**:
- `fetch` + custom wrapper: works, but the constitution names Axios; deviating buys nothing.
- Refresh-token rotation: not in this slice — the backend issues short-lived access tokens with no refresh endpoint; FR-013 maps 401 → sign-out.

---

## 3. Session persistence

**Decision**: `localStorage` key `progress-tracker.session` storing `{accessToken: string, user: User, expiresAt: ISOString}` (the Zustand `persist` middleware writes this). Hydration runs once at app start and gates the first render until complete to avoid the redirect flicker (FR-010).

**Rationale**:
- `localStorage` survives browser restart (FR-004) and supports the `storage` event for cross-tab consistency (FR-020).
- The constitution allows JWT storage but does not pin the mechanism; localStorage is acceptable because the app is a same-origin SPA without third-party iframes, and the JWT is short-lived (60 min default per backend spec FR-009).
- Storing `expiresAt` lets the client short-circuit a request when the token is already past expiry rather than waiting for the backend 401.

**Alternatives considered**:
- `sessionStorage`: would fail FR-004 (browser restart).
- HTTP-only cookies: more resistant to XSS but requires backend changes (set-cookie, CORS credentials) — out of scope for this slice; the backend issues a bearer token via JSON, not a cookie.
- IndexedDB: unnecessary; the session payload is tiny.

**XSS posture**: We accept that an attacker with script execution can read the token; the mitigation is the constitution's strict TS, no inline `dangerouslySetInnerHTML`, and Tailwind class-only styling. No third-party scripts are loaded by the auth pages.

---

## 4. Form validation

**Decision**: React Hook Form ≥ 7.50 with Zod 3 (`zodResolver` from `@hookform/resolvers/zod`). One Zod schema per form, derived TypeScript types via `z.infer`.

**Rationale**:
- Constitution explicit: "React Hook Form required for all forms", "Zod schema validation required".
- Zod gives a single source of truth for both the runtime check and the TS types — supports the "no implicit `any`" hard constraint.
- RHF's `formState.isSubmitting` powers `LoadingButton` (FR-014, SC-006).

**Password rule alignment**:
- Backend OpenAPI: `password.minLength = 8`, `maxLength = 128`, role enum `[admin, manager, developer]`.
- Spec FR-006 + Assumptions: min 8 chars, at least one letter and one digit (client hint only).
- Client schema therefore enforces `min(8)`, `max(128)`, `regex(/[A-Za-z]/)`, `regex(/\d/)`. Backend rejections that go beyond these (e.g., compromised-password block list, if ever added) surface as field errors via FR-008.

**Alternatives considered**:
- Formik + Yup: not in the constitution.
- Browser-native `<form>` validation: insufficient — no cross-field rules, no server-error binding.

---

## 5. Server state vs client state

**Decision**:
- **Server state** (anything from `/auth/*`) is owned by React Query.
  - `useLogin` and `useRegister` are `useMutation`s; on success they call `sessionStore.set(...)` with the response.
  - `useMe` is a `useQuery` keyed on `["auth","me"]` with `staleTime: 60_000`, refetch-on-focus enabled. Used by guards to revalidate the session against the backend.
- **Client state** (the persisted session blob, the hydration flag) is owned by Zustand.

**Rationale**:
- The constitution names both libraries with distinct responsibilities; this assignment honours both.
- Letting React Query refetch `/auth/me` on focus catches the "user was deleted server-side" and "role changed server-side" cases listed in the spec edge cases without bespoke polling.

**Alternatives considered**:
- Putting everything in Zustand: blurs the server/client boundary the constitution draws and re-invents caching.
- Putting everything in React Query: works, but cross-tab `storage` sync of the session blob is the natural job for the persistence layer Zustand already gives us.

---

## 6. Routing guards

**Decision**: Two component guards plus a hydration gate at the router root.

- `<HydrationGate>`: at the root layout, blocks render until `sessionStore.hydrated === true`. Renders a centered spinner.
- `<RequireAuth>`: wraps any protected branch. If no valid session, redirects to `/login` with `state: { from: location }` and a `replace` to keep the back button clean (FR-019).
- `<RequireRole roles={[...]}>`: nested under `<RequireAuth>` for role-restricted branches. On mismatch, redirects to `/unauthorized` (NOT `/login`) and preserves the originally requested URL only for diagnostics, not for redirect-back.

**Return-to behaviour**: `/login` reads `location.state?.from` on successful login and navigates with `replace`. If `from` is absent (direct visit to `/login`), navigates to `/`.

**Rationale**: Pure component guards match the data-router model and keep the logic colocated with the route tree. Two distinct components keep "no session" and "wrong role" cleanly separable — the spec calls out that the latter must NOT silently bounce to login (FR-011, SC-004).

**Alternatives considered**:
- `loader`-based guards: rejected for this slice because loaders run *outside* React, which complicates reading Zustand without a getState shim; component guards are clearer and ship faster.
- Combining both guards into one: leaks the 403 path into the 401 redirect logic and is the failure mode the spec explicitly warns against.

---

## 7. Component primitives (shadcn/ui consumption)

**Decision**: Copy the minimal set of shadcn/ui primitives (`button`, `input`, `label`, `form`, `card`) into `frontend/src/components/ui/` as the upstream `shadcn` CLI does. Add `clsx`, `tailwind-merge`, and `class-variance-authority` (the three runtime deps shadcn primitives use). Add `lucide-react` for the eye / eye-off icon used by `PasswordInput`.

**Rationale**:
- shadcn distributes source files, not an npm package; this matches the upstream model and the constitution.
- Limiting to five primitives keeps the surface tight; future modules can `npx shadcn add <component>` when they need more.

**Alternatives considered**:
- Hand-rolling primitives: more work, no benefit, and diverges from the constitution.
- Pulling in a heavier component library (MUI, Mantine): violates the constitution and adds tens of MB.

---

## 8. Testing stack

**Decision**:
- **Vitest** (works with Vite without extra config) + `@testing-library/react` + `@testing-library/user-event` + `jsdom`.
- **MSW** (`msw` v2) for component-test isolation against the auth contract; handlers live in `frontend/tests/mocks/auth-handlers.ts`.
- **Playwright** for end-to-end, using the real backend running at `http://localhost:8000` (developer is expected to have it up; CI will run `uv run uvicorn app.main:app` in a step before Playwright).

**Rationale**:
- Vitest is the first-party Vite test runner; zero-config for ESM and TS.
- MSW lets the component tests use the *same* request shapes as the e2e suite, which keeps drift between the layers minimal.
- Playwright is the strongest e2e option for SPA + token storage assertions (it can read `localStorage` directly).

**Alternatives considered**:
- Jest: needs more config under Vite + ESM and gives nothing extra here.
- Cypress: viable, but Playwright's multi-browser support and faster TS DX win.

---

## 9. Environment variables

**Decision**: One env var introduced: `VITE_API_BASE_URL`. `.env.development` and `.env.example` are added under `frontend/`. The Axios `baseURL` reads it; tests and Storybook (if added later) get `http://localhost:8000` by default.

**Rationale**: Vite-prefixed vars are statically inlined at build time and safe to commit defaults; no secrets are ever placed here (constitution: "Never hardcode secrets or tokens; use `.env` and docs").

**Alternatives considered**:
- Hard-coding `http://localhost:8000`: blocks any non-dev deployment.
- Runtime config endpoint: overkill for this slice.

---

## 10. Accessibility baseline

**Decision**: For the auth forms specifically:
- Every input has an associated `<label>` (RHF `<FormField>` from the shadcn `form` primitive handles this).
- The password show/hide toggle is a `<button type="button">` with `aria-label` toggled between "Show password" / "Hide password" and `aria-pressed` reflecting state.
- The single generic login error is rendered in an element with `role="alert"` and `aria-live="polite"` so screen readers announce it without yanking focus.
- The unauthorized page has an `<h1>` and a descriptive paragraph; the "go home" link is the first focusable item.

**Rationale**: Constitution names "Accessible forms (labels, ARIA where needed)". This is the minimum that satisfies WCAG 2.1 AA for these flows; further audits land with the design system feature.

---

## Open questions deferred to follow-up features

| Item | Why deferred | Owning feature (proposed) |
|------|--------------|---------------------------|
| 404 page | Closed-set routing in this slice; meaningful only once unknown destinations exist. | `010-app-shell` |
| Refresh-token rotation | Backend does not yet expose it. | A future `01x-auth-refresh` |
| Password reset / email verification | Out of scope per spec Assumptions. | A future `01x-account-recovery` |
| Dark mode toggle | Constitution-optional; design system will own it. | `010-app-shell` |

---

All NEEDS CLARIFICATION items from the Technical Context are resolved by the decisions above. No outstanding ambiguity blocks Phase 1.
