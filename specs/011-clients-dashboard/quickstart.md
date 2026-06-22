# Quickstart: Client Management Dashboard (Frontend)

**Feature**: `011-clients-dashboard` | **Date**: 2026-06-13

How to run, develop, and verify this feature. It is an additive module in the existing Vite + React frontend; no backend changes.

---

## Prerequisites

- The `004-clients-management` backend is running and reachable (default `http://localhost:8000`), seeded with a few clients across the duplicate/edge cases. (For UI dev/tests, MSW handlers stand in — the live backend is only needed for manual end-to-end checks.)
- Node toolchain already installed for the frontend (`frontend/node_modules` present). Frontend uses npm scripts (the `uv` rule applies to the Python backend only).
- A valid login for each role (admin, manager, developer) to exercise RBAC.

## Run the app

```powershell
cd D:\progress-tracker\frontend
npm run dev          # Vite dev server (default http://localhost:5173)
```

Sign in, then navigate to **Clients** in the top nav (visible only to admin/manager).

Environment: `VITE_API_BASE_URL` (see `frontend/.env.development`) points the Axios client at the backend.

## Routes added

| Path | Page | Access |
|---|---|---|
| `/clients` | `ClientsListPage` | admin, manager (developer → AccessDenied) |
| `/clients/:id` | `ClientDetailsPage` | admin, manager (developer → AccessDenied); unknown/deleted id → "Client not found" |

Both sit under the existing `RequireAuth` guard in `src/routes.tsx`.

## Manual verification (maps to spec user stories)

1. **US1 — List & search**: As admin, open `/clients`; confirm table shows name, company, email, phone, created date. Type a partial company/name/email/phone → rows narrow (no network call). Clear search → all return. As developer, open `/clients` → AccessDenied.
2. **US2 — Details cards**: Click a row → `/clients/:id`; confirm identity/contact/notes cards + timestamps. Empty optional fields show "Not provided". Deep-link the URL directly → same view. Visit a non-existent id → "Client not found".
3. **US3 — Create**: Click "New client", fill name/email/phone, save → dialog closes, client appears in list; reload → still there. Submit a duplicate email → dialog stays open, error on email field. Bad email/phone → inline validation, no request sent.
4. **US4 — Edit**: Open a client → Edit, change company name, save → cards + list update without reload. Change email to an existing one → conflict error on email field, dialog stays open. No changes → Save is a no-op close.
5. **US5 — Delete (admin)**: As admin, open a client → Delete → confirm → returns to list, client gone; revisit its URL → "Client not found". As manager, confirm no Delete control exists anywhere.
6. **US6 — RBAC**: Sign in as admin (Clients link, New/Edit/Delete), manager (Clients link, New/Edit, NO Delete), developer (no Clients link, `/clients` → AccessDenied). Let a session expire → next action redirects to login preserving the URL.

## Run the tests

```powershell
cd D:\progress-tracker\frontend
npm run test         # vitest run — all unit + component tests (MSW-backed)
npm run typecheck    # tsc -b --noEmit — no implicit any
npm run lint         # eslint
```

New tests for this feature live under `frontend/tests/unit/` and `frontend/tests/component/` (see plan.md tree). They register `tests/mocks/clients-handlers.ts` via `tests/mocks/server.ts` and reuse `tests/helpers/renderWithProviders.tsx`.

### What the tests cover (constitution Testing Standards)

- **Success**: list/create/edit/delete happy paths reflect in the UI.
- **Validation errors**: Zod blocks bad email/phone client-side; 422 maps to inline field errors.
- **RBAC**: per-role affordance presence/absence; 403 handling.
- **API behaviour**: 409 duplicate email & phone (distinct messages); 404 after delete.
- **Loading states**: skeletons; disabled+spinner save button.
- **Error states**: network retry on list and in dialogs without reload; entered values preserved.

## Definition of Done

- [ ] `npm run test`, `npm run typecheck`, `npm run lint` all green.
- [ ] All 6 user stories manually verified across the 3 roles.
- [ ] No direct API calls in components; all HTTP via `clients.api.ts` + hooks.
- [ ] Disallowed affordances absent from the DOM (not merely disabled) — confirmed by tests.
- [ ] Create/edit/delete reflect across list + detail with no manual reload.
- [ ] Duplicate email/phone surfaces inline without losing input.
