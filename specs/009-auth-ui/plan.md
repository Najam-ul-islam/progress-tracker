# Implementation Plan: Authentication UI (Login, Register, Protected Routing)

**Branch**: `009-auth-ui` | **Date**: 2026-05-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-auth-ui/spec.md`

## Summary

Build the user-facing authentication layer for the existing Vite + React 19 + Tailwind 4 frontend so it can talk to the already-shipped backend in `002-auth-jwt-rbac` (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`). The slice delivers a login page, a registration page, a sign-out action, gated routes, role-aware navigation, and a dedicated unauthorized page — wired together by a small auth module that owns session persistence, a single HTTP client that attaches the bearer token, and a Zustand session store consumed by guards and navigation. No backend changes; no new product features beyond auth plumbing.

Per-user-input scoping: the six numbered items (auth pages, API integration, JWT storage, protected routing, role-based navigation, validation/testing) map 1:1 onto the milestones in this plan and onto the user stories US1–US5 in the spec.

## Technical Context

**Language/Version**: TypeScript 6.0 (per `frontend/tsconfig.app.json`), React 19.2.
**Primary Dependencies**:
- Already present: `react`, `react-dom`, `tailwindcss` v4 with `@tailwindcss/vite`, `vite` 8, `eslint`.
- To add (constitution-mandated): `react-router-dom` (routing), `axios` (HTTP), `@tanstack/react-query` + `@tanstack/react-query-devtools` (server state), `react-hook-form` + `zod` + `@hookform/resolvers` (forms & validation), `zustand` (session store), `clsx` + `tailwind-merge` (component class utility), `lucide-react` (icon set used by shadcn-style components). shadcn/ui is consumed by copying small primitives (Button, Input, Label, Form, Card) into `src/components/ui/` rather than as an npm dep — matches the shadcn distribution model.

**Storage**:
- Client-only: `localStorage` for the persisted session blob (`{accessToken, user, expiresAt}`); the `storage` event drives cross-tab logout (FR-020).
- No new backend storage.

**Testing**:
- Unit/component: Vitest + `@testing-library/react` + `@testing-library/user-event` + `jsdom`.
- End-to-end: Playwright, one suite per P1 user story plus the role-routing P2 happy path.
- MSW (`msw`) for component-test isolation against the auth contract.

**Target Platform**: Modern evergreen browsers (Chromium, Firefox, Safari current and current-1). No legacy IE/older Safari fallback.

**Project Type**: Web application — separate `backend/` (FastAPI, already shipped) and `frontend/` (this slice). Plan modifies only `frontend/`.

**Performance Goals**: First authenticated page paint ≤ 5 s on a typical broadband cold load (SC-001); zero perceptible flicker between session-validation completion and the destination route render (SC-007).

**Constraints**:
- Constitution-Hard: no `any`, no API calls from UI components, no business logic in pages, all forms via React Hook Form + Zod, protected routes mandatory, 401→sign-out, 403 page mandatory.
- Bearer token MUST be attached to every authenticated request by a single Axios instance (DRY).
- A single in-flight auth submission per form (FR-014, SC-006).

**Scale/Scope**:
- 4 pages (login, register, unauthorized, an authenticated landing placeholder), ~10 components (`AuthLayout`, `AuthForm`, `PasswordInput`, `LoadingButton`, plus shadcn primitives), 1 module (`src/modules/auth/`), 1 shared HTTP client, 1 Zustand session store, 1 routing tree with two guards (`<RequireAuth>`, `<RequireRole>`).
- The authenticated landing area is a thin placeholder in this slice; subsequent feature branches will fill it with module-specific pages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Five core principles plus Frontend Standards from `.specify/memory/constitution.md`:

| Gate | Status | Evidence |
|---|---|---|
| I. Spec-First Development | ✅ | `specs/009-auth-ui/spec.md` exists and passes its checklist; no code yet. |
| II. Modular Monolith Architecture | ✅ | Auth lives in `frontend/src/modules/auth/` with the mandated `pages/ components/ hooks/ services/ schemas/ store/` sub-tree; no cross-module reach. |
| III. Deterministic Development | ✅ | Spec defines inputs, outputs, validations, and edge cases for every flow; plan resolves the remaining technical unknowns. |
| IV. Incremental Evolution | ✅ | This slice adds a self-contained module; the only changes outside it are mounting `<App>` with `BrowserRouter`, a `QueryClientProvider`, and a root layout — additive, no rewrites. |
| V. AI-Native Workflow | ✅ | Following the `/sp.specify → /sp.plan → /sp.tasks → /sp.implement` order. |
| Frontend Stack | ✅ | React+TS, Tailwind, shadcn/ui (file-copy primitives), React Query, Axios, React Hook Form + Zod, Zustand — all adopted in this plan. |
| Frontend Module Structure | ✅ | `pages/ components/ hooks/ services/ schemas/ store/` enforced inside `modules/auth/`. |
| Architecture Rules | ✅ | API calls only in `services/`; UI components consume hooks (React Query mutations). No `any` (TS strict-leaning config already in place). |
| Form Standards | ✅ | RHF + Zod for login and register; password rules expressed in a shared schema. |
| State Management Rules | ✅ | React Query for `/auth/me` revalidation; Zustand for the session blob; no prop drilling beyond a layout level. |
| Routing & Security | ✅ | `<RequireAuth>` and `<RequireRole>` guards; 401 interceptor; 403 (unauthorized) page; 404 page is *out of scope for this slice* — flagged as a follow-up so the constitution requirement is met before the first non-auth feature ships. |
| UI/UX Standards | ✅ | Responsive forms, loading state via `LoadingButton`, error states (single generic for login; field-level for register), accessible labels and aria attributes, empty-state n/a for auth. |
| Testing Standards | ✅ | Vitest + Playwright cover success cases, validation errors, RBAC restrictions (US5), loading and error states. |
| Hard Constraints | ✅ | No `any`; no direct API in components; no business logic in routes (pages); no token decoding by hand beyond `exp` for client-side expiry gating. |

**Gate result**: PASS. One advisory follow-up captured outside the gate: the constitution requires a 404 page; this slice ships the 403 page only and explicitly defers 404 to `010-app-shell` (or the next non-auth feature that introduces unknown routes). Recording in Complexity Tracking below to make the deferral auditable.

## Project Structure

### Documentation (this feature)

```text
specs/009-auth-ui/
├── plan.md                # This file (/sp.plan command output)
├── spec.md                # Feature spec
├── research.md            # Phase 0 output (resolves technical unknowns)
├── data-model.md          # Phase 1 output (client-side data shapes)
├── quickstart.md          # Phase 1 output (how to run/test the slice)
├── contracts/
│   ├── auth-client.md     # Internal TS contract for the auth service
│   └── backend-refs.md    # Pointer to the backend OpenAPI (single source of truth)
├── checklists/
│   └── requirements.md    # Spec quality checklist (already passing)
└── tasks.md               # Phase 2 output (/sp.tasks command — NOT created here)
```

### Source Code (repository root)

The slice touches `frontend/` only. Backend (`backend/`, already shipped by `002-auth-jwt-rbac`) is consumed as a contract, not modified.

```text
frontend/
├── src/
│   ├── App.tsx                                # Mounts QueryClientProvider + RouterProvider
│   ├── main.tsx                               # Entry — unchanged shape; wraps <App>
│   ├── routes.tsx                             # Single router definition (createBrowserRouter)
│   ├── components/
│   │   └── ui/                                # shadcn-style primitives (copied, not imported)
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── form.tsx
│   │       └── card.tsx
│   ├── lib/
│   │   ├── http.ts                            # Axios instance + interceptors (attach token, 401→logout)
│   │   ├── query-client.ts                    # React Query singleton
│   │   └── cn.ts                              # clsx + tailwind-merge utility
│   └── modules/
│       └── auth/
│           ├── pages/
│           │   ├── LoginPage.tsx              # US1
│           │   ├── RegisterPage.tsx           # US2
│           │   ├── UnauthorizedPage.tsx       # US5 (403)
│           │   └── AuthenticatedLanding.tsx   # placeholder home after login
│           ├── components/
│           │   ├── AuthLayout.tsx             # Centered card layout used by all auth pages
│           │   ├── AuthForm.tsx               # Generic <form> wrapper around RHF
│           │   ├── PasswordInput.tsx          # Input + show/hide toggle (FR-015)
│           │   ├── LoadingButton.tsx          # Submit button with in-flight state (FR-014)
│           │   ├── RequireAuth.tsx            # Route guard — session present? else /login
│           │   └── RequireRole.tsx            # Route guard — role allowed? else /unauthorized
│           ├── hooks/
│           │   ├── useLogin.ts                # React Query mutation → /auth/login
│           │   ├── useRegister.ts             # React Query mutation → /auth/register
│           │   ├── useMe.ts                   # React Query query → /auth/me (revalidate on focus)
│           │   └── useLogout.ts               # Clears session + invalidates queries
│           ├── services/
│           │   └── auth.api.ts                # Axios calls — login, register, me
│           ├── schemas/
│           │   ├── login.schema.ts            # Zod: email + password
│           │   └── register.schema.ts         # Zod: name + email + password + role
│           └── store/
│               └── session.store.ts           # Zustand — accessToken, user, expiresAt, hydration flag
└── tests/
    ├── unit/
    │   ├── auth.schema.test.ts
    │   ├── session.store.test.ts
    │   └── http.interceptor.test.ts
    ├── component/
    │   ├── LoginPage.test.tsx                 # MSW-backed
    │   ├── RegisterPage.test.tsx
    │   └── RequireAuth.test.tsx
    └── e2e/
        ├── login.spec.ts                      # US1 + edge cases
        ├── register.spec.ts                   # US2
        ├── logout.spec.ts                     # US3
        ├── protected-routing.spec.ts          # US4 (deep-link → login → return-to)
        └── role-routing.spec.ts               # US5 (unauthorized page)
```

**Structure Decision**: The constitution-mandated frontend module structure (`pages/ components/ hooks/ services/ schemas/ store/`) is applied inside `frontend/src/modules/auth/`. Shared HTTP and React Query plumbing live in `frontend/src/lib/` because they are app-global, not auth-specific. `tests/` is colocated under `frontend/tests/` (Vitest + Playwright) rather than next to source files, because the e2e suite already needs a single Playwright config root and uniform paths keep CI configuration trivial.

## Complexity Tracking

> Filled only where the plan deviates from the constitution or its defaults.

| Violation / Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------------------|------------|--------------------------------------|
| 404 page deferred to a later slice | This slice has a closed set of routes (login, register, unauthorized, authenticated landing). Without unknown destinations the 404 page would have nothing meaningful to do, and shipping it would also force a choice of catch-all behaviour better made when the first non-auth route is introduced. | Shipping a 404 now would commit prematurely to a fallback (redirect to landing? show 404 even when signed out?) — better deferred and tracked in the next plan. |
| shadcn/ui consumed by file copy (no npm dep) | shadcn distributes primitives via the `shadcn` CLI as source files; the constitution names shadcn/ui specifically. Copying primitives into `components/ui/` matches both the constitution and the upstream model and keeps the dependency surface small. | Adopting a different component lib (Mantine, MUI) would violate the constitution; adopting shadcn-flavoured npm packages (e.g., `shadcn-react`) introduces churn and is not the upstream-recommended path. |
