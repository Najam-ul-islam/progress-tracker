---
id: 0004
title: Auth UI MVP implementation
stage: green
date: 2026-05-12
surface: agent
model: claude-sonnet-4-6
feature: 009-auth-ui
branch: 009-auth-ui
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: [frontend, auth, react, vitest, msw, rhf, zod, zustand]
links:
  spec: specs/009-auth-ui/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - frontend/package.json
  - frontend/vite.config.ts
  - frontend/vitest.config.ts
  - frontend/tsconfig.app.json
  - frontend/index.html
  - frontend/.env.example
  - frontend/.env.development
  - frontend/.gitignore
  - frontend/src/App.tsx
  - frontend/src/routes.tsx
  - frontend/src/lib/cn.ts
  - frontend/src/lib/http.ts
  - frontend/src/lib/query-client.ts
  - frontend/src/components/ui/button.tsx
  - frontend/src/components/ui/input.tsx
  - frontend/src/components/ui/label.tsx
  - frontend/src/components/ui/card.tsx
  - frontend/src/components/ui/form.tsx
  - frontend/src/modules/auth/types.ts
  - frontend/src/modules/auth/store/session.store.ts
  - frontend/src/modules/auth/store/cross-tab.ts
  - frontend/src/modules/auth/schemas/login.schema.ts
  - frontend/src/modules/auth/schemas/register.schema.ts
  - frontend/src/modules/auth/services/auth.api.ts
  - frontend/src/modules/auth/hooks/useLogin.ts
  - frontend/src/modules/auth/hooks/useRegister.ts
  - frontend/src/modules/auth/hooks/useLogout.ts
  - frontend/src/modules/auth/components/AuthLayout.tsx
  - frontend/src/modules/auth/components/PasswordInput.tsx
  - frontend/src/modules/auth/components/LoadingButton.tsx
  - frontend/src/modules/auth/components/HydrationGate.tsx
  - frontend/src/modules/auth/components/RequireAuth.tsx
  - frontend/src/modules/auth/components/AppHeader.tsx
  - frontend/src/modules/auth/pages/LoginPage.tsx
  - frontend/src/modules/auth/pages/RegisterPage.tsx
  - frontend/src/modules/auth/pages/UnauthorizedPage.tsx
  - frontend/src/modules/auth/pages/AuthenticatedLanding.tsx
  - frontend/tests/setup.ts
  - frontend/tests/mocks/auth-handlers.ts
  - frontend/tests/mocks/server.ts
tests:
  - frontend/tests/unit/login.schema.test.ts
  - frontend/tests/unit/register.schema.test.ts
  - frontend/tests/unit/session.store.test.ts
  - frontend/tests/unit/http.interceptor.test.ts
  - frontend/tests/component/LoginPage.test.tsx
  - frontend/tests/component/RegisterPage.test.tsx
  - frontend/tests/component/useLogout.test.tsx
---

## Prompt

/sp.implement
Use reusable components. Use React Hook Form + Zod. No inline business logic. Modular structure only.

Scope (user-selected): MVP (US1+US2+US3) — with tests. Setup + Foundational + Login + Register + Sign-out, Vitest unit + component tests, NO Playwright e2e, NO US4 protected-routing-tests, NO US5 role-based nav, NO Polish phase. Skip T030, T043, T050.

## Response snapshot

Implemented the auth UI MVP per the 009-auth-ui plan and tasks, honoring the user-selected scope:

- Phase 1 Setup: installed runtime + dev deps; configured `vitest.config.ts`, `vite.config.ts`, `tsconfig.app.json` with the `@` alias; added `.env.example`/`.env.development`; updated `.gitignore`.
- Phase 2 Foundational: `cn`, shadcn primitives (Button, Input, Label, Card, Form/FormField/FormItem/FormLabel/FormControl/FormMessage), `types.ts` (Role/User/TokenResponse/AuthError/ClearReason), Zustand session store with `persist` + `decodeJwtExp`, cross-tab sync, Axios `http` with bearer + 401-clear (excluding `/auth/login` and `/auth/register`), `query-client`, `routes.tsx` with `HydrationGate` + `RequireAuth`, App wiring, MSW handlers + server.
- US1 Login: `login.schema.ts`, `auth.api.login()` with wire→camelCase rename and `AuthError` mapping, `useLogin`, `AuthLayout`, `PasswordInput`, `LoadingButton`, `LoginPage` (RHF + zodResolver, "from" return-to, `role="alert"` for invalid-creds + session-ended reason, password cleared on failure, "Create an account" link carrying email).
- US2 Register: `register.schema.ts`, `auth.api.register()` (POST register then auto-login), `useRegister`, `RegisterPage` with name/email/password/role select and field-level error mapping for 409/422.
- US3 Sign-out: `useLogout` (clears session, clears React Query cache, navigates to `/login`), `AppHeader` mounted inside `AuthenticatedLanding`; bfcache disabled via `<meta http-equiv="Cache-Control" content="no-store">` in `index.html`.

Design decision: skipped T035 `AuthForm` wrapper — shadcn's `Form` (which is `FormProvider`) already plays that role; a no-op wrapper would violate the "reusable components" rule.

Validation:

- `npm run typecheck` → PASS (after adding `"ignoreDeprecations": "6.0"` for the deprecated-but-still-needed `baseUrl` in TS 6.0).
- `npm run test` → 7 test files, 31 tests, all passing in 20.89s.

Deferred (per scope): T006 playwright config, T030/T043/T050 e2e tests, US4 protected-routing-tests, US5 role-based nav, Polish phase.

## Outcome

- ✅ Impact: Authentication UI MVP is wired end-to-end against the backend contract (`/auth/login`, `/auth/register`, `/auth/me`). Users can sign in, register (with auto-login), see a placeholder authenticated landing, sign out, and recover from a 401 (session ended). Cross-tab sign-out works via the `storage` event.
- 🧪 Tests: 31 passed across 7 files — schema validation (login + register), session store + selectors, Axios interceptors (bearer + 401 behaviors for auth vs non-auth endpoints), LoginPage flows (valid/invalid/redirect/session-ended), RegisterPage flows (validation/happy/email-in-use), useLogout. No e2e by scope.
- 📁 Files: ~30 source files, 7 test files, 3 config files touched. All code lives under `frontend/` per modular structure rule.
- 🔁 Next prompts: when ready, layer US4 (RequireAuth tests + useMe `/auth/me` revalidation + `session-ended` UX on `/login`) and US5 (role-based nav). Then Phase 8 Polish.
- 🧠 Reflection: shadcn `Form` already is `FormProvider`, so an extra `AuthForm` wrapper would have been pure duplication. Honoring the user's "reusable components" rule means choosing not to write a layer that adds no value.

## Evaluation notes (flywheel)

- Failure modes observed: none in tests. One typecheck failure during validation (TS 6.0 deprecated `baseUrl` + `Button asChild` not implemented in the local shadcn Button) — both fixed.
- Graders run and results (PASS/FAIL): typecheck PASS; vitest 31/31 PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): add a Playwright config + a single smoke e2e for login when the backend has a seed user, to validate the wire shape against the real API.
