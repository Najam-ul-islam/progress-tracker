---
description: "Task list for 009-auth-ui — frontend authentication UI"
---

# Tasks: Authentication UI (Login, Register, Protected Routing)

**Input**: Design documents from `/specs/009-auth-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED. The constitution mandates frontend loading/error-state tests and RBAC validation, and the user prompt for this slice explicitly lists "Validate auth flow" as a deliverable. Test tasks therefore appear inside each user-story phase (Vitest + MSW for component-level, Playwright for end-to-end) and are authored *before* the implementation tasks they cover so each story's acceptance is grounded in failing tests first.

**Organization**: Tasks are grouped by user story so each P1 story can ship as an independent vertical slice. US1 → US3 together form the MVP; US4 hardens the routing tree; US5 (P2) is layered on once a role-restricted route is ever introduced.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1–US5); omitted for Setup/Foundational/Polish
- File paths are absolute or repo-relative; every implementation task names exactly one file

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the dependencies and tooling the slice needs without touching any auth code yet.

- [X] T001 Add runtime deps to `frontend/package.json` (`react-router-dom`, `axios`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `react-hook-form`, `zod`, `@hookform/resolvers`, `zustand`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`)
- [X] T002 Add dev deps to `frontend/package.json` (`vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`, `@playwright/test`)
- [X] T003 [P] Add npm scripts to `frontend/package.json` (`"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"`, `"typecheck": "tsc -b --noEmit"`)
- [X] T004 [P] Create `frontend/vitest.config.ts` (jsdom env, setup file, alias `@` → `src`)
- [X] T005 [P] Create `frontend/tests/setup.ts` (imports `@testing-library/jest-dom`, starts MSW server in `beforeAll`)
- [ ] T006 [P] Create `frontend/playwright.config.ts` (baseURL `http://localhost:5173`, projects: chromium + firefox, webServer: `npm run dev`)
- [X] T007 [P] Create `frontend/.env.example` with `VITE_API_BASE_URL=http://localhost:8000`
- [X] T008 [P] Create `frontend/.env.development` mirroring `.env.example` and add `.env.development` to `frontend/.gitignore` if not already ignored
- [X] T009 [P] Run `npm install` inside `frontend/` to materialise the lockfile

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: App-global plumbing every user story depends on — Tailwind plumbing utility, shadcn primitives, the shared HTTP client, the session store, the QueryClient, and the router shell. No auth-specific business logic yet.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T010 [P] Create `frontend/src/lib/cn.ts` exporting `cn(...inputs)` using `clsx` + `tailwind-merge`
- [X] T011 [P] Create `frontend/src/components/ui/button.tsx` (shadcn-style Button with `cva` variants: default/secondary/ghost/destructive, sizes sm/md/lg, uses `cn`)
- [X] T012 [P] Create `frontend/src/components/ui/input.tsx` (shadcn-style `<input>` with forwarded ref and Tailwind base styles)
- [X] T013 [P] Create `frontend/src/components/ui/label.tsx` (shadcn-style label tied to inputs by `htmlFor`)
- [X] T014 [P] Create `frontend/src/components/ui/card.tsx` (Card, CardHeader, CardTitle, CardContent, CardFooter exports)
- [X] T015 [P] Create `frontend/src/components/ui/form.tsx` (RHF-aware `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` per shadcn upstream)
- [X] T016 Create `frontend/src/modules/auth/types.ts` exporting `Role`, `ROLES`, `User`, `TokenResponse`, `AuthError`, `AuthErrorKind` per `data-model.md`
- [X] T017 Create `frontend/src/modules/auth/store/session.store.ts` (Zustand `persist` middleware, key `progress-tracker.session`, persists `{accessToken, user, expiresAt}` only, exposes `setSession`, `clear`, `isExpired`, `hydrated` flag) (depends on T016)
- [X] T018 [P] Create `frontend/src/modules/auth/store/cross-tab.ts` exporting `attachCrossTabSync()` that registers a `storage` event listener on the session key and calls `sessionStore.getState().clear("user-initiated")` when the slice is removed in another tab (depends on T017)
- [X] T019 Create `frontend/src/lib/http.ts` (Axios instance with `baseURL = import.meta.env.VITE_API_BASE_URL`, request interceptor attaches `Authorization: Bearer <token>` from `sessionStore.getState()`, response interceptor maps 401 on non-`/auth/login` calls to `sessionStore.clear("session-ended")` then rethrows) (depends on T017)
- [X] T020 [P] Create `frontend/src/lib/query-client.ts` exporting a singleton `QueryClient` (defaults: `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: true`)
- [X] T021 Create `frontend/src/routes.tsx` with `createBrowserRouter([...])` defining `/login`, `/register`, `/unauthorized`, `/` placeholders (placeholder components for now, replaced in US phases) and a root `<HydrationGate>` wrapper that blocks render until `sessionStore.hydrated === true`, showing a centered spinner (depends on T017)
- [X] T022 Rewrite `frontend/src/App.tsx` to render `<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>` and call `attachCrossTabSync()` once on mount (depends on T019, T020, T021, T018)
- [X] T023 [P] Update `frontend/src/main.tsx` to remove the default Vite demo render path and mount `<App />` only (no other changes)
- [X] T024 [P] Add `frontend/tests/mocks/auth-handlers.ts` (MSW handlers for `POST /auth/login`, `POST /auth/register`, `GET /auth/me`; happy + 401 + 409 + 422 variants exported as named factories)
- [X] T025 [P] Add `frontend/tests/mocks/server.ts` instantiating `setupServer(...handlers)` and exporting `server`

**Checkpoint**: foundation ready — app boots into the hydration gate, then to `/login` placeholder. User stories can now begin in parallel.

---

## Phase 3: User Story 1 — Sign in with existing credentials (Priority: P1) 🎯 MVP

**Goal**: A returning user can submit email + password on the login page and reach the authenticated landing area; the session persists across refresh and browser restart.

**Independent Test**: Open `/login`, submit a known-good email + password against a backend (or MSW), and assert: (a) the user lands on `/`, (b) the user remains on `/` after a page refresh, (c) attempting to revisit `/login` while signed in redirects to `/`.

### Tests for User Story 1 ⚠️

> Write these tests FIRST, ensure they FAIL before implementation. They serve as the executable acceptance criteria for US1.

- [X] T026 [P] [US1] Unit test for the login Zod schema in `frontend/tests/unit/login.schema.test.ts` (asserts empty email/password reject, malformed email rejects, valid input passes)
- [X] T027 [P] [US1] Unit test for the session store in `frontend/tests/unit/session.store.test.ts` (asserts `setSession` populates fields and computes `expiresAt` from a fake JWT, `clear` resets, `isExpired` returns true when `expiresAt` is past)
- [X] T028 [P] [US1] Unit test for the Axios interceptor in `frontend/tests/unit/http.interceptor.test.ts` (asserts bearer header attached when token present, 401 on `/auth/me` clears session, 401 on `/auth/login` does NOT clear session)
- [X] T029 [P] [US1] Component test in `frontend/tests/component/LoginPage.test.tsx` (MSW-backed: happy path navigates to `/`, wrong-password renders single generic error and clears the password field, double-click results in one in-flight request)
- [ ] T030 [P] [US1] E2E test in `frontend/tests/e2e/login.spec.ts` (signs in with a fixture user against the real backend, asserts landing on `/`, then reloads and asserts still on `/`)

### Implementation for User Story 1

- [X] T031 [P] [US1] Create `frontend/src/modules/auth/schemas/login.schema.ts` exporting `loginSchema` (email + password) and `LoginInput`
- [X] T032 [P] [US1] Create `frontend/src/modules/auth/services/auth.api.ts` with `login(input)` only for now (POST `/auth/login`, rename `access_token`→`accessToken`, throw `AuthError("invalid-credentials")` on 401, throw `AuthError("validation", …)` on 422) — `register` and `fetchCurrentUser` are added by US2 and US4 respectively (depends on T016, T019)
- [X] T033 [US1] Create `frontend/src/modules/auth/hooks/useLogin.ts` exposing a `useMutation` that calls `auth.api.login` and on success calls `sessionStore.getState().setSession(response)` (depends on T032, T017)
- [X] T034 [P] [US1] Create `frontend/src/modules/auth/components/AuthLayout.tsx` (centered card layout, app title, slot for the form; responsive `sm`/`md`/`lg` per UI/UX standards) (depends on T014)
- [X] T035 [P] [US1] Create `frontend/src/modules/auth/components/AuthForm.tsx` (generic RHF `<form>` wrapper accepting `schema`, `onSubmit`, `defaultValues`, renders children with `FormProvider`) (depends on T015)
- [X] T036 [P] [US1] Create `frontend/src/modules/auth/components/PasswordInput.tsx` (Input + eye-icon button, `aria-label` toggles "Show password"/"Hide password", `aria-pressed` reflects state, preserves value on toggle — FR-015) (depends on T012)
- [X] T037 [P] [US1] Create `frontend/src/modules/auth/components/LoadingButton.tsx` (Button + `isLoading` prop, disables and shows spinner; uses RHF `formState.isSubmitting` when nested inside a form) (depends on T011)
- [X] T038 [US1] Create `frontend/src/modules/auth/pages/LoginPage.tsx` (uses `AuthLayout`, `AuthForm` with `loginSchema`, fields email + `PasswordInput`, submit via `useLogin`; on success navigates to `location.state?.from ?? "/"` with `replace`; renders a single `role="alert"` top-level error for `AuthError("invalid-credentials")`; clears password field on failure; if already signed in, immediately `Navigate` to `/`) (depends on T031, T033, T034, T035, T036, T037)
- [X] T039 [US1] Create `frontend/src/modules/auth/pages/AuthenticatedLanding.tsx` (placeholder home: greets user by name from `sessionStore`, renders a `Sign out` button hooked to a `useLogout` stub that clears the store and navigates to `/login`; expanded in later features) (depends on T017)
- [X] T040 [US1] Wire `LoginPage` and `AuthenticatedLanding` into `frontend/src/routes.tsx`, replacing the placeholders from T021; add a `<RequireAuth>` import placeholder (real component lands in US4 — for US1 the route is open and immediately redirects unauthenticated users to `/login` via an inline check in the landing page) (depends on T038, T039)

**Checkpoint**: US1 fully functional. A user can sign in, see a placeholder landing page, sign out, and sign back in. Tests T026–T030 pass.

---

## Phase 4: User Story 2 — Create a new account (Priority: P1)

**Goal**: A new user fills the registration form, submits, and is signed in automatically without a second login round-trip.

**Independent Test**: Open `/register`, submit fresh `{name, email, password, role: developer}`, and assert (a) landing on `/`, (b) sign out, (c) sign back in via US1 with the same credentials.

### Tests for User Story 2 ⚠️

- [X] T041 [P] [US2] Unit test for the register Zod schema in `frontend/tests/unit/register.schema.test.ts` (asserts password complexity rules: <8 chars, no letter, no digit each reject; role enum rejects unknown values; valid input passes)
- [X] T042 [P] [US2] Component test in `frontend/tests/component/RegisterPage.test.tsx` (MSW-backed: happy path auto-signs-in and navigates to `/`; 409 email-in-use attaches an inline error to the email field; password visibility toggle preserves the typed value)
- [ ] T043 [P] [US2] E2E test in `frontend/tests/e2e/register.spec.ts` (registers a fresh email, asserts landing on `/`, signs out, signs back in via login form)

### Implementation for User Story 2

- [X] T044 [P] [US2] Create `frontend/src/modules/auth/schemas/register.schema.ts` exporting `registerSchema` (name + email + password complexity + role enum from `ROLES`) and `RegisterInput`
- [X] T045 [US2] Extend `frontend/src/modules/auth/services/auth.api.ts` with `register(input)` — POST `/auth/register`, on 201 immediately POST `/auth/login` with the same `{email, password}` and return that `TokenResponse`; map 409 → `AuthError("email-in-use", …, {email: "Email already registered"})`, map 422 → `AuthError("validation", …, fieldErrors)` (depends on T032, T044)
- [X] T046 [US2] Create `frontend/src/modules/auth/hooks/useRegister.ts` exposing a `useMutation` that calls `auth.api.register` and on success calls `sessionStore.setSession(response)` (depends on T045, T017)
- [X] T047 [US2] Create `frontend/src/modules/auth/pages/RegisterPage.tsx` (uses `AuthLayout`, `AuthForm` with `registerSchema`, fields name + email + `PasswordInput` + role `<select>` listing `ROLES`; submit via `useRegister`; on `AuthError("email-in-use")` calls RHF `setError("email", ...)`; on `AuthError("validation")` fans out `fieldErrors` to `setError` per key; on success navigates to `/`; link to `/login` pre-populates email via router state) (depends on T044, T046, T034, T035, T036, T037)
- [X] T048 [US2] Wire `RegisterPage` into `frontend/src/routes.tsx` at `/register`; update `LoginPage` to render a "Create an account" link that navigates to `/register` carrying the typed email if present (depends on T047)

**Checkpoint**: US2 fully functional. US1 and US2 are both independently usable.

---

## Phase 5: User Story 3 — Sign out (Priority: P1)

**Goal**: An authenticated user can sign out from anywhere; the persisted session is cleared, they return to `/login`, and protected URLs no longer render from cache.

**Independent Test**: While signed in, activate sign-out, then assert (a) location is `/login`, (b) `localStorage["progress-tracker.session"]` is absent, (c) the back button does not show a cached protected page.

### Tests for User Story 3 ⚠️

- [X] T049 [P] [US3] Component test in `frontend/tests/component/useLogout.test.tsx` (asserts the hook clears the session store, invalidates React Query cache, and navigates to `/login`)
- [ ] T050 [P] [US3] E2E test in `frontend/tests/e2e/logout.spec.ts` (signs in, clicks sign-out, asserts `/login`, asserts localStorage cleared, asserts back-button does not render the protected page)

### Implementation for User Story 3

- [X] T051 [P] [US3] Create `frontend/src/modules/auth/hooks/useLogout.ts` returning a callback that calls `sessionStore.clear("user-initiated")`, calls `queryClient.clear()`, and `navigate("/login", {replace: true})` (depends on T017, T020)
- [X] T052 [US3] Create `frontend/src/components/AppHeader.tsx` (visible only on authenticated routes; renders the user name from `sessionStore` and a `Sign out` button wired to `useLogout`); a thin component scoped to this slice but placed in `src/components/` because it is app-global, not auth-module-internal (depends on T051, T011)
- [X] T053 [US3] Mount `<AppHeader>` inside `AuthenticatedLanding` from T039, replacing the inline sign-out stub; also set the route layout's `meta` to disable bfcache by adding `<meta http-equiv="Cache-Control" content="no-store">` in `frontend/index.html` so back-navigation does not show a cached protected page (depends on T052, T039)

**Checkpoint**: US3 fully functional. The MVP is now complete (US1 + US2 + US3); a developer can register, sign in, and sign out end-to-end.

---

## Phase 6: User Story 4 — Protected routing keeps unauthenticated users out (Priority: P1)

**Goal**: Every page other than `/login`, `/register`, and `/unauthorized` is gated. Direct navigation to a protected URL while signed out redirects to `/login` and, after sign-in, returns the user to the originally requested URL with no flash of protected content.

**Independent Test**: While signed out, paste three different protected URLs into the address bar; each must redirect to `/login`. After signing in, the user must land on the originally requested URL, not on `/`.

### Tests for User Story 4 ⚠️

- [ ] T054 [P] [US4] Component test in `frontend/tests/component/RequireAuth.test.tsx` (renders a `<RequireAuth>` wrapping a marker child, asserts redirect to `/login` when store is empty, asserts marker child renders when store is populated, asserts `location.state.from` carries the originally requested path)
- [ ] T055 [P] [US4] Component test in `frontend/tests/component/useMe.test.tsx` (asserts 401 from `/auth/me` triggers `sessionStore.clear("session-ended")` and the `session-ended` notice flag is set)
- [ ] T056 [P] [US4] E2E test in `frontend/tests/e2e/protected-routing.spec.ts` (parameterised over the protected URLs, asserts deep-link → `/login` → after login returns to original URL with no protected-content flicker; SC-007 + SC-008)

### Implementation for User Story 4

- [ ] T057 [P] [US4] Extend `frontend/src/modules/auth/services/auth.api.ts` with `fetchCurrentUser()` — GET `/auth/me`, return `User`, let 401 propagate so the interceptor handles it (depends on T032)
- [ ] T058 [P] [US4] Create `frontend/src/modules/auth/hooks/useMe.ts` exposing `useQuery({queryKey: ["auth","me"], queryFn: fetchCurrentUser, staleTime: 60_000, refetchOnWindowFocus: true, enabled: selectIsAuthenticated})` (depends on T057, T017)
- [ ] T059 [US4] Create `frontend/src/modules/auth/components/RequireAuth.tsx` (reads `selectIsAuthenticated` from the store; if false, renders `<Navigate to="/login" replace state={{from: location, reason: sessionStore.getState().lastClearReason}} />`; otherwise renders `<Outlet />` and lazily kicks `useMe` so a stale token gets revalidated) (depends on T017, T058)
- [ ] T060 [US4] Update `frontend/src/routes.tsx` to wrap the authenticated branch (currently just `/`) in `<RequireAuth>`, remove the inline check from `AuthenticatedLanding`, and ensure `/login` reads `location.state?.from` to redirect back after success (LoginPage from T038 already supports this — verify the wiring) (depends on T059, T038)
- [ ] T061 [US4] Update `frontend/src/modules/auth/pages/LoginPage.tsx` to render the "session ended" banner when `location.state?.reason === "session-ended"`, using a non-alarming wording ("Your session has ended. Please sign in again.") consumed from a constant module so wording is single-sourced (depends on T038, T059)

**Checkpoint**: US4 fully functional. The routing guarantee from FR-009/FR-010/FR-019 is enforced. SC-004, SC-007, SC-008 are verifiable.

---

## Phase 7: User Story 5 — Role-based navigation and access (Priority: P2)

**Goal**: The primary navigation and access to specific routes are driven by the signed-in user's role. A role mismatch lands on `/unauthorized`, not `/login` and not a 404.

**Independent Test**: Sign in as each of `admin`, `manager`, `developer`. Confirm `/unauthorized` renders cleanly when a developer attempts to reach a route this slice declares admin-only (a fixture route added in T064 below, deletable once a real admin-only route ships).

### Tests for User Story 5 ⚠️

- [ ] T062 [P] [US5] Component test in `frontend/tests/component/RequireRole.test.tsx` (asserts allowed role renders child, disallowed role renders `<Navigate to="/unauthorized" replace />`, no flicker)
- [ ] T063 [P] [US5] E2E test in `frontend/tests/e2e/role-routing.spec.ts` (signs in as `developer`, navigates to the fixture admin-only URL from T064, asserts `/unauthorized` body content and that no `/login` redirect occurred)

### Implementation for User Story 5

- [ ] T064 [P] [US5] Create `frontend/src/modules/auth/components/RequireRole.tsx` (`<RequireRole roles={Role[]}>` nested inside `<RequireAuth>`; uses `selectCanAccess`; on mismatch renders `<Navigate to="/unauthorized" replace />`) (depends on T017, T059)
- [ ] T065 [P] [US5] Create `frontend/src/modules/auth/pages/UnauthorizedPage.tsx` (renders an `<h1>`, a clear explanation that this role lacks access, a "Back to home" link to `/`, and a sign-out control via `useLogout`; first focusable item is the home link) (depends on T051, T011)
- [ ] T066 [US5] Create `frontend/src/components/RoleAwareNav.tsx` (declares a nav-item array `{label, to, allowedRoles}`, filters via `selectRole`, renders inside `AppHeader`) and update `AppHeader` from T052 to mount it (depends on T052, T017)
- [ ] T067 [US5] Wire `UnauthorizedPage` and `RequireRole` into `frontend/src/routes.tsx`; add a fixture admin-only route `/__admin-only-fixture` guarded by `<RequireRole roles={["admin"]}>` so US5 has something to test against (TODO comment marks it for deletion once a real admin-only route ships) (depends on T064, T065)

**Checkpoint**: US5 fully functional. The 403 path is exercised by the fixture route; the role-aware nav mechanism is in place ready for future features.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tighten quality across all stories. Each item touches >1 story or is constitution-mandated.

- [ ] T068 [P] Add `frontend/src/modules/auth/hooks/useLogin.test.tsx` covering the "one in-flight request on rapid double-submit" assertion at the hook level (SC-006)
- [ ] T069 [P] Add `frontend/tests/component/PasswordInput.test.tsx` for the show/hide toggle's `aria-label`, `aria-pressed`, and value preservation
- [ ] T070 [P] Add `frontend/tests/component/LoadingButton.test.tsx` for the in-flight disabled state and the spinner rendering
- [ ] T071 Run `npm run typecheck` from `frontend/` and fix any reported errors — gate: zero `any`, zero unused exports (constitution Hard Constraint)
- [ ] T072 Run `npm run lint` from `frontend/` and fix all violations
- [ ] T073 [P] Verify responsive breakpoints (`sm`, `md`, `lg`, `xl`) on `/login`, `/register`, `/unauthorized` and the authenticated landing — manual checklist captured in `specs/009-auth-ui/quickstart.md` section 8
- [ ] T074 [P] Verify keyboard-only flow end-to-end against `specs/009-auth-ui/quickstart.md` section 8
- [ ] T075 [P] Add a one-line lint rule (or a CI grep step) forbidding imports of `axios` outside `frontend/src/lib/http.ts` and imports of `auth.api` outside `frontend/src/modules/auth/hooks/**` — implemented as an `eslint-plugin-boundaries` config in `frontend/eslint.config.js`
- [ ] T076 Run the full Playwright suite against a fresh backend with `uv run uvicorn app.main:app` and confirm all SC-001/SC-003/SC-004/SC-005/SC-006/SC-007/SC-008 gates pass per `quickstart.md` section 7
- [ ] T077 Delete the `/__admin-only-fixture` route added by T067 only when a real admin-only route is introduced by a later feature; until then leave the TODO comment in place — captured here so the cleanup is not forgotten
- [ ] T078 Update `frontend/README.md` with a "Running the auth UI" section pointing to `specs/009-auth-ui/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; start immediately
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all user stories
- **US1 (Phase 3)**: depends on Foundational
- **US2 (Phase 4)**: depends on Foundational; reuses the auth components from US1 (`AuthLayout`, `AuthForm`, `PasswordInput`, `LoadingButton`) and `auth.api.login` — can begin in parallel with US1 only after T032/T034–T037 land, otherwise sequentially after US1
- **US3 (Phase 5)**: depends on US1 (needs `AuthenticatedLanding` and a session to clear)
- **US4 (Phase 6)**: depends on Foundational; can begin in parallel with US1 once the store and routes shell exist; the LoginPage `from` redirect tie-in (T060) syncs with US1 T038
- **US5 (Phase 7)**: depends on US4 (uses `RequireAuth`); P2, schedule last
- **Polish (Phase 8)**: depends on all desired user stories being complete

### Within Each User Story

- Tests are authored before implementation and MUST fail first
- Schemas before services
- Services before hooks
- Hooks before pages
- Pages before route wiring

### Parallel Opportunities

- All of Phase 1's `[P]` tasks (T003–T009) run in parallel after T001/T002 land
- All Phase 2 `[P]` tasks for shadcn primitives (T010–T015) and MSW mocks (T024, T025) run in parallel; T017 depends on T016; T019 depends on T017; T021 depends on T017
- Within a user story, all `[P]` test tasks and all `[P]` component tasks run in parallel
- US1, US2, and US4 can be split across developers after Phase 2 lands; US3 trails US1; US5 trails US4

---

## Parallel Example: User Story 1

```bash
# Author all US1 tests together (they must fail first):
Task: "Unit test for the login schema in frontend/tests/unit/login.schema.test.ts"
Task: "Unit test for the session store in frontend/tests/unit/session.store.test.ts"
Task: "Unit test for the Axios interceptor in frontend/tests/unit/http.interceptor.test.ts"
Task: "Component test in frontend/tests/component/LoginPage.test.tsx"
Task: "E2E test in frontend/tests/e2e/login.spec.ts"

# Author US1 leaf components together:
Task: "Create AuthLayout in frontend/src/modules/auth/components/AuthLayout.tsx"
Task: "Create AuthForm in frontend/src/modules/auth/components/AuthForm.tsx"
Task: "Create PasswordInput in frontend/src/modules/auth/components/PasswordInput.tsx"
Task: "Create LoadingButton in frontend/src/modules/auth/components/LoadingButton.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3 (US1): login + session + persistence
4. Complete Phase 4 (US2): register + auto-login
5. Complete Phase 5 (US3): sign-out + bfcache disable
6. **STOP and VALIDATE**: a fresh user can register → sign out → sign back in; refresh and browser-restart leave the session intact
7. Deploy/demo

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 → MVP-1 (existing users can sign in)
3. + US2 → MVP-2 (new users self-serve)
4. + US3 → MVP-3 (full credential lifecycle)
5. + US4 → routing tree hardened, originally requested URL preserved
6. + US5 → role-aware nav + 403 page in place for the next feature's first admin-only route
7. Polish → CI gates green

### Parallel Team Strategy

After Phase 2 lands:
- Developer A: US1 (login)
- Developer B: US2 (register), starting after US1's shared components (T034–T037) land
- Developer C: US4 (protected routing), starting from the store/route shell

Then sequence US3 after US1, and US5 after US4.

---

## Notes

- `[P]` = different files, no dependency on incomplete tasks
- `[Story]` label = `US1`–`US5`, matching spec story IDs
- Every implementation task names exactly one file
- Tests are authored before the implementation they cover; commit the failing test first, then the code that makes it pass
- Commit cadence: one commit per task or per logical leaf group within a `[P]` cluster
- Constitution gates re-evaluated at the end of Phase 8 via T071, T072, T075, T076
- Do not bypass `<RequireAuth>` for new routes added by later features; if a route should be public, declare it as a sibling of `/login` in `routes.tsx`, not as a child of the protected branch
