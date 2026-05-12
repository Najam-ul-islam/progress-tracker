# Quickstart: Users Management

**Feature**: `003-users-management`
**Date**: 2026-05-02
**Audience**: a developer who wants to walk the feature end-to-end against a local
dev environment after the implementation is merged.

## Prerequisites

- Repo cloned, on branch `003-users-management` (or a branch that has merged it).
- `backend/.env` filled in. **Use a non-prod `DATABASE_URL`** for this walk —
  `postgresql+psycopg2://postgres:postgres@localhost:5432/progress_tracker_dev` or a
  fresh SQLite DB. The auth feature's quickstart (T035 in feature 002) was deferred
  for the same reason; do not skip this step.
- `uv` installed and on `PATH`.

## Step 1 — sync deps and apply migrations

```bash
cd backend
uv sync
uv run alembic upgrade head
```

You should see two revisions apply: `20260502_user` (feature 002 — creates `user`)
and `20260503_user_is_active_updated_at` (this feature — adds the two columns).

## Step 2 — run the test suite

```bash
uv run pytest tests/ -q
```

Expectation: 17 cases from feature 002 + roughly 18 new cases from this feature
(US1×3, US2×6, US3×7, US4×4, US5×3, last-admin×3, password_hash sweep ×1) — exact
count finalised in `tasks.md`. All green.

## Step 3 — start the dev server

```bash
uv run uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs`. You should see the existing `auth` endpoints
plus six new ones tagged `users`:

- `GET /users/me`
- `GET /users`
- `GET /users/developers`
- `GET /users/{id}`
- `PATCH /users/{id}`
- `PATCH /users/{id}/status`

## Step 4 — seed three users via the auth module

The users module does **not** create users (that is auth's job). Use the existing
`POST /auth/register` to seed one of each role:

```bash
curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ada Admin","email":"admin@test.local","password":"correct-horse-battery-staple","role":"admin"}'

curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Mia Manager","email":"manager@test.local","password":"correct-horse-battery-staple","role":"manager"}'

curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Dev One","email":"dev1@test.local","password":"correct-horse-battery-staple","role":"developer"}'
```

Then log each in to capture three bearer tokens:

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@test.local","password":"correct-horse-battery-staple"}' | jq -r .access_token)

MGR_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"manager@test.local","password":"correct-horse-battery-staple"}' | jq -r .access_token)

DEV_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"dev1@test.local","password":"correct-horse-battery-staple"}' | jq -r .access_token)
```

## Step 5 — walk the user stories

### US1 — `GET /users/me` works for every role

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/users/me
curl -H "Authorization: Bearer $MGR_TOKEN"   http://localhost:8000/users/me
curl -H "Authorization: Bearer $DEV_TOKEN"   http://localhost:8000/users/me
```

Each must return the caller's own record. **No `password_hash`** in any body.

### US2 — list and read

```bash
# Admin can list everyone
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/users

# Manager can list everyone
curl -H "Authorization: Bearer $MGR_TOKEN"   http://localhost:8000/users

# Developer is forbidden
curl -i -H "Authorization: Bearer $DEV_TOKEN" http://localhost:8000/users    # 403

# Developer reading themselves works
DEV_ID=$(curl -s -H "Authorization: Bearer $DEV_TOKEN" http://localhost:8000/users/me | jq -r .id)
curl -H "Authorization: Bearer $DEV_TOKEN" "http://localhost:8000/users/$DEV_ID"   # 200

# Developer reading anyone else is forbidden
ADMIN_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/users/me | jq -r .id)
curl -i -H "Authorization: Bearer $DEV_TOKEN" "http://localhost:8000/users/$ADMIN_ID"   # 403
```

### US3 — admin updates a developer

```bash
# Promote dev1 to manager
curl -X PATCH "http://localhost:8000/users/$DEV_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"role":"manager"}'

# Confirm
curl -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/users/$DEV_ID"

# Manager attempting any PATCH is forbidden (even on themselves)
curl -i -X PATCH "http://localhost:8000/users/$DEV_ID" \
  -H "Authorization: Bearer $MGR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"sneaky"}'   # 403

# Empty body is rejected
curl -i -X PATCH "http://localhost:8000/users/$DEV_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'   # 422

# Email is forbidden
curl -i -X PATCH "http://localhost:8000/users/$DEV_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"new@test.local"}'   # 422
```

### US4 — admin deactivates and reactivates

```bash
# Deactivate dev1
curl -X PATCH "http://localhost:8000/users/$DEV_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"is_active":false}'

# Login attempt as dev1 ⇒ 401
curl -i -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"dev1@test.local","password":"correct-horse-battery-staple"}'   # 401

# Reactivate
curl -X PATCH "http://localhost:8000/users/$DEV_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"is_active":true}'

# Last-admin guard: try to deactivate the only admin
curl -i -X PATCH "http://localhost:8000/users/$ADMIN_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"is_active":false}'   # 409
```

### US5 — developer roster

```bash
# After reverting dev1 to developer (PATCH role:"developer"), list developers
curl -X PATCH "http://localhost:8000/users/$DEV_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"role":"developer"}'

curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/users/developers
curl -H "Authorization: Bearer $MGR_TOKEN"   http://localhost:8000/users/developers
curl -i -H "Authorization: Bearer $DEV_TOKEN" http://localhost:8000/users/developers   # 403
```

## Step 6 — run the CI audit scripts

```bash
bash backend/scripts/audit_jose_imports.sh    # SC-006 (jose only in core.security)
bash backend/scripts/audit_auth_imports.sh    # SC-007 (auth imports only users)
bash backend/scripts/audit_users_imports.sh   # FR-020 (users only imports auth.dependencies)
```

All three must print `OK: …` and exit 0.

## Step 7 — Swagger sanity check

Reload `http://localhost:8000/docs`. Expand the `users` tag. Each endpoint should
have:

- The exact request/response shapes from `contracts/openapi.yaml`.
- A 401/403/404/409/422 response set for the writes; 401/403 for the reads.
- No `password_hash` field anywhere in the schemas panel.

## Cleanup

```bash
# If you used a throwaway dev DB:
DROP DATABASE progress_tracker_dev;
# or, for SQLite: rm backend/dev.sqlite
```

The branch is safe to merge once steps 1–7 all pass.
