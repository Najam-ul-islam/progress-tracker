# Implementation Plan: Client Management Dashboard (Frontend)

**Branch**: `011-clients-dashboard` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-clients-dashboard/spec.md`

## Summary

Build the **frontend** client-management dashboard as a new `clients` module under `frontend/src/modules/clients/`, consuming the existing `004-clients-management` backend contract unchanged. The feature delivers a clients list (table + client-side search), a client details page (contact-info cards), create/edit dialogs, and an admin-only delete confirmation, all RBAC-gated (admin+manager view/create/edit; admin-only delete; developers fully denied).

The technical approach **mirrors the `010-users-dashboard` module verbatim** — same layering (`services/` Axios wire-mapper → `hooks/` React Query → `schemas/` Zod + RHF → `components/` + `pages/`), same error class pattern (`ClientsApiError` with `code`/`fieldErrors`), same RBAC helpers in `@/lib/rbac`, same routing-under-`RequireAuth` and `RequireClientsAccess` gating, same MSW-backed component/unit tests under `frontend/tests/`. The only new shapes are the `Client` entity, full-CRUD mutations (the users dashboard had no create/delete), and the dual create/edit dialog with 409 duplicate-field handling.

The five user input themes map directly onto phases: (1) Clients dashboard → list page + chrome; (2) CRUD forms → create/edit/delete dialogs + Zod schemas; (3) Table integration → ClientsTable + filters + row actions; (4) API integration → clients.api.ts + hooks; (5) Validation/testing → Zod alignment + MSW component/unit tests.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict), React 19.2
**Primary Dependencies**: React Router 7, TanStack React Query 5, React Hook Form 7 + Zod 4 (`@hookform/resolvers`), Axios 1.16, Zustand 5, TailwindCSS 4, shadcn/ui primitives (Radix Dialog), lucide-react
**Storage**: N/A on the frontend — server state via React Query cache; session state via Zustand `session.store`; filter state in URL query string
**Testing**: Vitest 4 + Testing Library + jsdom; MSW 2 for HTTP mocking (`frontend/tests/{unit,component,mocks,helpers}`)
**Target Platform**: Modern evergreen browsers (SPA built by Vite 8)
**Project Type**: Web (frontend module added to existing `frontend/` app; no backend changes)
**Performance Goals**: List renders usable view (table or skeleton) within 1 s on broadband (SC-002); find-a-client in <5 s (SC-001); React Query `staleTime: 30_000` + `refetchOnWindowFocus` for instant revisits (FR-006)
**Constraints**: No direct API calls in components (constitution); no implicit `any`; client-side filtering only (FR-004); affordances absent from DOM — not disabled — for disallowed roles (FR-029); WCAG-grade keyboard + screen-reader support for dialogs (SC-008)
**Scale/Scope**: Low-hundreds of clients in a single unpaginated fetch; ~1 service, ~6 hooks, ~5 schemas/helpers, ~10 components, 2 pages, ~12 test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` → **Frontend Standards**, **Routing & Security Rules**, **Form Standards**, **State Management Rules**, **UI/UX Standards**, **Hard Constraints**.

| Constitution requirement | Plan compliance |
|---|---|
| **Stack**: React+TS, Tailwind, shadcn/ui, React Query, Axios, RHF+Zod, Zustand | ✅ All used; identical to 009/010 |
| **Module Structure**: `pages/ components/ hooks/ services/ schemas/ store/` | ✅ New `modules/clients/` uses this exact layout (no `store/` needed — no client-only global state beyond URL params) |
| **No direct API calls in UI components** | ✅ All HTTP in `clients.api.ts`, consumed only via hooks |
| **No business logic in UI components** | ✅ Wire-mapping, diffing, validation live in `services/` + `schemas/` |
| **Type safety — no implicit `any`** | ✅ Wire types + domain types fully declared; `tsc -b --noEmit` gate |
| **Form Standards**: RHF + Zod, shared form components | ✅ `Form`/`FormField` shadcn primitives + Zod resolver, mirroring `EditUserDialog` |
| **State Management**: React Query for server state, Zustand for UI | ✅ React Query for list/detail/mutations; URL params for filter; session via existing Zustand store |
| **Routing & Security**: protected routes, role-aware nav, 403/404 pages | ✅ Routes under `RequireAuth`; `RequireClientsAccess` gate; AccessDenied (403) + not-found states; nav link via `IfRole` |
| **UI/UX**: responsive, loading, error, empty states, accessible forms, skeletons | ✅ Skeletons, ErrorState w/ retry, EmptyState (search-empty + first-run), focus-trapped dialogs |
| **Testing Standards**: success, validation errors, RBAC, API, loading, error states | ✅ Phase covers all six via MSW component tests + unit tests |
| **Hard Constraints** (no direct DB/route logic; no API-in-component; no `any`; no duplicate logic) | ✅ No violations |

**Result**: PASS. No deviations; no Complexity Tracking entries required. (The feature is additive and follows the precedent module exactly, satisfying Principle IV — Incremental Evolution.)

## Project Structure

### Documentation (this feature)

```text
specs/011-clients-dashboard/
├── plan.md              # This file (/sp.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (frontend consumption contract)
│   └── clients-frontend-contract.md
├── checklists/
│   └── requirements.md  # From /sp.specify
└── tasks.md             # Phase 2 output (/sp.tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/src/
├── lib/
│   └── rbac.ts                              # +canViewClients, +canEditClients, +canDeleteClients
├── routes.tsx                               # +/clients and /clients/:id routes
├── modules/
│   ├── auth/components/AppHeader.tsx        # +Clients nav link (IfRole admin|manager)
│   └── clients/                             # NEW module (mirrors modules/users)
│       ├── types.ts                         # Client, ClientDraft, ClientsApiError, ClientsApiErrorCode
│       ├── services/
│       │   └── clients.api.ts               # list/get/create/update/remove + wire mappers + CLIENTS_QUERY_KEYS
│       ├── hooks/
│       │   ├── useClientsList.ts            # useQuery (staleTime 30s, refetchOnWindowFocus)
│       │   ├── useClient.ts                 # useQuery(detail, {enabled})
│       │   ├── useCreateClient.ts           # useMutation → invalidate list
│       │   ├── useUpdateClient.ts           # useMutation → setQueryData(detail) + invalidate
│       │   ├── useDeleteClient.ts           # useMutation → invalidate list + remove detail
│       │   └── useFilteredClients.ts        # client-side substring filter (name/company/email/phone)
│       ├── schemas/
│       │   ├── client-form.schema.ts        # Zod: create + edit values, toCreateBody, diffDraft, clientToFormValues
│       │   └── clients-filter.schema.ts     # Zod: { q }, parseFilter, filterToParams
│       ├── components/
│       │   ├── RequireClientsAccess.tsx     # gate → AccessDenied when !canViewClients
│       │   ├── AccessDenied.tsx             # 403 state (module-local, mirrors users)
│       │   ├── EmptyState.tsx               # reused shape (search-empty + first-run)
│       │   ├── ErrorState.tsx               # retry-able error
│       │   ├── ClientsTable.tsx             # columns + row click + per-row Edit/Delete (RBAC)
│       │   ├── ClientsFilters.tsx           # search input bound to URL params
│       │   ├── ContactInfoCards.tsx         # identity / contact / notes cards + timestamps
│       │   ├── ClientFormDialog.tsx         # dual create+edit dialog (mode prop)
│       │   └── DeleteClientDialog.tsx       # confirmation dialog (admin only)
│       └── pages/
│           ├── ClientsListPage.tsx          # RequireClientsAccess + header + filters + table + dialogs
│           └── ClientDetailsPage.tsx        # deep-linkable; cards + Edit/Delete affordances
└── ...

frontend/tests/
├── mocks/
│   └── clients-handlers.ts                  # NEW MSW handlers + seededClients
├── unit/
│   ├── clients.api.test.ts                  # wire mapping + error mapping (401/403/404/409/422/network)
│   ├── client-form.schema.test.ts           # email/phone/name validation + diffDraft + toCreateBody
│   ├── clients-filter.schema.test.ts        # parse/serialize round-trip
│   ├── useFilteredClients.test.ts           # multi-field substring filtering
│   └── rbac.clients.test.ts                 # canView/canEdit/canDelete per role
└── component/
    ├── ClientsListPage.test.tsx             # render, search, empty/first-run, error+retry, RBAC, row→nav
    ├── ClientDetailsPage.test.tsx           # cards, deep link, not-found, access-denied, placeholders
    ├── ClientFormDialog.test.tsx            # create+edit, validation, 409 field error, network retry, focus trap
    ├── DeleteClientDialog.test.tsx          # confirm/cancel, loading, network error, admin-only
    └── AppHeader.clients.test.tsx           # Clients link visible for admin/manager, absent for developer
```

**Structure Decision**: Web project — additive frontend module. The new `modules/clients/` directory follows the constitution's mandated frontend module structure and copies the `modules/users/` precedent file-for-file in shape, so reviewers and tests recognise the layout immediately. No `store/` slice is added (the only client-only state is the search term, which lives in the URL per the 010 precedent). Shared UI primitives in `components/ui/` are reused unchanged; module-local `AccessDenied`/`EmptyState`/`ErrorState` mirror the users module rather than prematurely hoisting them to a shared location (a future refactor can hoist if a third consumer appears).

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
