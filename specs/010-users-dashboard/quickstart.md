# Quickstart: Users Management Dashboard

**Feature**: 010-users-dashboard
**Date**: 2026-05-12

## Prerequisites

1. Backend `003-users-management` is running locally at `http://localhost:8000` with a seeded database containing at least one user per role (admin / manager / developer).
2. Frontend dependencies installed: `cd frontend && npm install`.
3. `frontend/.env.development` points `VITE_API_BASE_URL=http://localhost:8000`.

## Run

```bash
cd frontend
npm run dev          # Vite dev server on http://localhost:5173
npm run typecheck    # tsc --noEmit
npm run test         # vitest --run
```

## Manual verification (7 steps)

Run with the dev server up and three seeded accounts (admin@x, manager@x, dev@x; password `password123`).

1. **Admin sees the list.** Sign in as admin → `/users` → table renders with all seeded users, role badges visible, "Edit" actions on every row.
2. **Client-side filter works.** Type "ada" in the search box → rows narrow without a network request (verify in DevTools Network tab). Select "Role: manager" → only managers remain. Click "Clear filters" from empty state to reset.
3. **Profile deep link.** Click any row → URL becomes `/users/<id>`. Reload the page → same profile renders. "Edit user" button visible.
4. **Edit happy path.** Click "Edit user" → modal opens prefilled. Change name → Save → modal closes, profile + list reflect new name immediately, no full-page reload. Reload manually → name still persists.
5. **Edit self-deactivate guard.** Open own profile, toggle isActive off, Save → modal stays open, inline error from backend visible, value preserved.
6. **Manager view.** Sign out, sign in as manager → "Users" link still visible, list renders, "Edit" actions absent on every row (inspect DOM — buttons should not exist). Profile page renders read-only with no Edit button.
7. **Developer view.** Sign out, sign in as developer → "Users" link absent from nav. Type `/users` in URL → Access Denied state. Type `/users/<other-id>` → Access Denied. Type `/users/<own-id>` → read-only profile renders.

## Smoke against tests

```bash
npm run test -- users     # runs every users.* test
```

Expected: all schemas, api adapter, hooks, list page, profile page, and edit dialog tests pass.

## Troubleshooting

- **CORS errors** → confirm backend `CORS_ORIGINS` includes `http://localhost:5173`.
- **401 immediately on load** → token expired; sign in again.
- **Empty list with no error** → seeded data may be empty; check backend `GET /users` directly with curl.
- **Edit button visible to manager** → likely missing `<IfRole>` boundary; check `RBAC matrix` contract.
