# Quickstart: Clients Management

**Feature**: `004-clients-management`
**Date**: 2026-05-03
**Audience**: a developer who wants to walk the feature end-to-end against a
local dev environment after the implementation is merged.

## Prerequisites

- Repo cloned, on branch `004-clients-management` (or a branch that has
  merged it).
- `backend/.env` filled in. **Use a non-prod `DATABASE_URL`** for this walk
  (a fresh SQLite file or a throwaway Postgres DB). Features 002/003
  quickstarts deferred for the same reason; do not skip this step.
- `uv` installed and on `PATH`.

## Step 1 — sync deps and apply migrations

```bash
cd backend
uv sync
uv run alembic upgrade head
```

You should see three revisions apply: `20260502_user` (feature 002),
`20260503_user_is_active_updated_at` (feature 003), and **`20260504_client`**
(this feature — creates `client` plus the two partial unique indexes).

## Step 2 — run the test suite

```bash
uv run pytest tests/ -q
```

Expectation: 17 cases from feature 002 + 47 from feature 003 + roughly 25
new cases from this feature (US1×10, US2×7, US3×8, US4×7, audit script ×1) —
exact count finalised in `tasks.md`. All green.

## Step 3 — start the dev server

```bash
uv run uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs`. You should see the existing `auth` and
`users` endpoints plus five new ones tagged `clients`:

- `POST /clients`
- `GET /clients`
- `GET /clients/{id}`
- `PATCH /clients/{id}`
- `DELETE /clients/{id}`

## Step 4 — seed users via the auth module, then capture tokens

The clients module does not create users; reuse the auth module's
registration to seed one of each role. (If your DB already has users from
feature 003's quickstart, skip the registers and only run the logins.)

```bash
curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ada Admin","email":"admin@example.com","password":"correct-horse-battery-staple","role":"admin"}'

curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Mia Manager","email":"manager@example.com","password":"correct-horse-battery-staple","role":"manager"}'

curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Dev One","email":"dev1@example.com","password":"correct-horse-battery-staple","role":"developer"}'

ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"correct-horse-battery-staple"}' | jq -r .access_token)

MGR_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"manager@example.com","password":"correct-horse-battery-staple"}' | jq -r .access_token)

DEV_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"dev1@example.com","password":"correct-horse-battery-staple"}' | jq -r .access_token)
```

## Step 5 — walk the user stories

### US1 — admin and manager create clients; developer is rejected

```bash
# Admin creates a client
curl -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Acme Corp","email":"contact@acme.example.com","phone":"+1-415-555-0101","company_name":"Acme Holdings"}'

# Manager creates another
curl -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $MGR_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Beta LLC","email":"hello@beta.example.com","phone":"+44 20 7946 0000","notes":"Inbound from referral"}'

# Developer is forbidden
curl -i -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $DEV_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Should Not Work","email":"x@example.com","phone":"+15555550000"}'   # 403

# Duplicate email → 409
curl -i -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Dup","email":"contact@acme.example.com","phone":"+15555550100"}'    # 409 client with this email already exists

# Duplicate phone → 409
curl -i -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Dup","email":"new@example.com","phone":"+1-415-555-0101"}'           # 409 client with this phone already exists

# Bad phone (no +) → 422
curl -i -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Bad","email":"bad@example.com","phone":"5555550100"}'                # 422

# Unknown field → 422
curl -i -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"X","email":"x@example.com","phone":"+15555550100","is_vip":true}'    # 422
```

### US2 — list and read

```bash
# Admin lists everyone (active only)
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/clients

# Manager lists everyone (active only)
curl -H "Authorization: Bearer $MGR_TOKEN"   http://localhost:8000/clients

# Developer is forbidden
curl -i -H "Authorization: Bearer $DEV_TOKEN" http://localhost:8000/clients   # 403

# Read by id
ACME_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/clients | jq -r '.[0].id')
curl -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/clients/$ACME_ID"   # 200

# Non-existent id
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/clients/99999     # 404

# Developer cannot read by id either
curl -i -H "Authorization: Bearer $DEV_TOKEN" "http://localhost:8000/clients/$ACME_ID"  # 403
```

### US3 — admin or manager updates a client

```bash
# Admin renames
curl -X PATCH "http://localhost:8000/clients/$ACME_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Acme Holdings"}'

# Manager updates notes
curl -X PATCH "http://localhost:8000/clients/$ACME_ID" \
  -H "Authorization: Bearer $MGR_TOKEN" -H 'Content-Type: application/json' \
  -d '{"notes":"Owes us a kickoff doc"}'

# Empty body → 422
curl -i -X PATCH "http://localhost:8000/clients/$ACME_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{}'   # 422

# Cross-row email collision: try to change Acme's email to Beta's
BETA_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/clients | jq -r '.[1].id')
curl -i -X PATCH "http://localhost:8000/clients/$ACME_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"hello@beta.example.com"}'                                              # 409

# Developer cannot PATCH
curl -i -X PATCH "http://localhost:8000/clients/$ACME_ID" \
  -H "Authorization: Bearer $DEV_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"hax"}'                                                                  # 403
```

### US4 — admin soft-deletes a client

```bash
# Manager attempting DELETE → 403
curl -i -X DELETE "http://localhost:8000/clients/$BETA_ID" \
  -H "Authorization: Bearer $MGR_TOKEN"                                                 # 403

# Admin soft-deletes
curl -i -X DELETE "http://localhost:8000/clients/$BETA_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"                                               # 204

# Soft-deleted row is gone from reads
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/clients/$BETA_ID"  # 404
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/clients               # Beta absent

# Re-using Beta's email is now allowed (uniqueness is among active rows only)
curl -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Beta Renewed","email":"hello@beta.example.com","phone":"+44 20 7946 0001"}'   # 201

# Re-deleting an already-soft-deleted id → 404
curl -i -X DELETE "http://localhost:8000/clients/$BETA_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"                                                # 404
```

## Step 6 — run the CI audit scripts

```bash
bash backend/scripts/audit_jose_imports.sh      # SC-006 (jose only in core.security)
bash backend/scripts/audit_auth_imports.sh      # SC-007 (auth imports only users)
bash backend/scripts/audit_users_imports.sh     # FR-020 from feature 003
bash backend/scripts/audit_clients_imports.sh   # FR-020 from this feature
```

All four must print `OK: …` and exit 0.

## Step 7 — Swagger sanity check

Reload `http://localhost:8000/docs`. Expand the `clients` tag. Each endpoint
should have:

- The exact request/response shapes from `contracts/openapi.yaml`.
- A 401/403/404/409/422 response set for the writes; 401/403/404 for the
  read-by-id; 401/403 for the list; 401/403/404 (and 204 success) for delete.
- The `phone` `pattern` `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$` visible on
  `ClientCreate` / `ClientUpdate`.
- `is_active` on `ClientRead` (visible to admins/managers).

## Cleanup

```bash
# If you used a throwaway dev DB:
DROP DATABASE progress_tracker_dev;
# or, for SQLite: rm backend/dev.sqlite
```

The branch is safe to merge once steps 1–7 all pass.
