# Quickstart: Projects Management

**Feature**: `005-projects`
**Date**: 2026-05-04
**Audience**: a developer who wants to walk the feature end-to-end against a
local dev environment after the implementation is merged.

## Prerequisites

- Repo cloned, on branch `005-projects` (or a branch that has merged it).
- `backend/.env` filled in. **Use a non-prod `DATABASE_URL`** — a fresh
  SQLite file or a throwaway Postgres DB.
- `uv` installed and on `PATH`.

## Step 1 — sync deps and apply migrations

```bash
cd backend
uv sync
uv run alembic upgrade head
```

Expected revisions applied: `20260502_user`, `20260503_user_is_active_updated_at`,
`20260504_client`, and **`20260504_project`** (this feature — creates `project`
and `project_module` plus their indexes and CHECK constraints).

## Step 2 — run the test suite

```bash
uv run pytest tests/ -q
```

Expectation: feature 002 (auth) + feature 003 (users) + feature 004
(clients) + the new projects suite all green. Exact count finalised in
`tasks.md`; expect ~50 new cases distributed across `test_projects_*.py`,
`test_modules_*.py`, and `test_projects_progress.py`.

## Step 3 — start the dev server

```bash
uv run uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs`. You should see existing `auth`, `users`,
`clients` endpoints plus eight new ones tagged `projects` / `modules`:

- `POST /projects`
- `GET /projects`
- `GET /projects/{id}`
- `PATCH /projects/{id}`
- `DELETE /projects/{id}`
- `GET /projects/{id}/progress`
- `POST /projects/{id}/modules`
- `PATCH /modules/{id}`
- `DELETE /modules/{id}`
- `PATCH /modules/{id}/progress`

## Step 4 — seed users and a client, then capture tokens

```bash
# Register: admin, manager, two developers (Dev1, Dev2)
for ROLE in admin manager developer; do
  EMAIL="${ROLE}@example.com"
  curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
    -d "{\"name\":\"${ROLE^} U\",\"email\":\"${EMAIL}\",\"password\":\"correct-horse-battery-staple\",\"role\":\"${ROLE}\"}"
done

curl -X POST http://localhost:8000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Dev Two","email":"developer2@example.com","password":"correct-horse-battery-staple","role":"developer"}'

ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"correct-horse-battery-staple"}' | jq -r .access_token)
MGR_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"manager@example.com","password":"correct-horse-battery-staple"}' | jq -r .access_token)
DEV_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.com","password":"correct-horse-battery-staple"}' | jq -r .access_token)
DEV2_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"developer2@example.com","password":"correct-horse-battery-staple"}' | jq -r .access_token)

# Seed a client (feature 004 — required by FR-005)
curl -X POST http://localhost:8000/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Acme Corp","email":"contact@acme.example.com","phone":"+1-415-555-0101"}'

CLIENT_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/clients | jq -r '.[0].id')
DEV_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/users | jq -r '.[] | select(.email=="developer@example.com").id')
DEV2_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/users | jq -r '.[] | select(.email=="developer2@example.com").id')
```

## Step 5 — walk the user stories

### US1 — admin/manager create a project; developer is rejected

```bash
curl -X POST http://localhost:8000/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Migration Sprint\",\"client_id\":${CLIENT_ID},\"total_amount\":\"10000.00\",\"start_date\":\"2026-06-01\",\"end_date\":\"2026-08-31\"}"   # 201

curl -i -X POST http://localhost:8000/projects \
  -H "Authorization: Bearer $DEV_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Should Fail\",\"client_id\":${CLIENT_ID},\"total_amount\":\"5000.00\",\"start_date\":\"2026-06-01\",\"end_date\":\"2026-08-31\"}"   # 403

# Bad client_id → 422
curl -i -X POST http://localhost:8000/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Bad","client_id":99999,"total_amount":"100.00","start_date":"2026-06-01","end_date":"2026-08-31"}'   # 422

# Bad date range → 422
curl -i -X POST http://localhost:8000/projects \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Bad\",\"client_id\":${CLIENT_ID},\"total_amount\":\"100.00\",\"start_date\":\"2026-08-31\",\"end_date\":\"2026-06-01\"}"   # 422
```

### US2 — list and read; developer-visibility filter

```bash
PROJECT_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/projects | jq -r '.[0].id')

curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/projects               # 200, contains the project
curl -H "Authorization: Bearer $MGR_TOKEN"   http://localhost:8000/projects               # 200, same
curl -H "Authorization: Bearer $DEV_TOKEN"   http://localhost:8000/projects               # 200, []  (Dev1 is unassigned)
curl -i -H "Authorization: Bearer $DEV_TOKEN" "http://localhost:8000/projects/$PROJECT_ID" # 404 (hidden, not 403)
```

### US3, US4 — add modules, then activate

```bash
# Add three modules summing to 70%
curl -X POST "http://localhost:8000/projects/$PROJECT_ID/modules" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Auth slice\",\"assigned_developer_id\":${DEV_ID},\"share_percentage\":\"30.00\"}"   # 201

curl -X POST "http://localhost:8000/projects/$PROJECT_ID/modules" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Data layer\",\"assigned_developer_id\":${DEV2_ID},\"share_percentage\":\"30.00\"}"   # 201

curl -X POST "http://localhost:8000/projects/$PROJECT_ID/modules" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"UI shell\",\"assigned_developer_id\":${DEV_ID},\"share_percentage\":\"10.00\"}"   # 201 (cumulative 70.00)

# A 4th module would 422
curl -i -X POST "http://localhost:8000/projects/$PROJECT_ID/modules" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Overflow\",\"assigned_developer_id\":${DEV_ID},\"share_percentage\":\"5.00\"}"   # 422

# Wrong-role assignee → 422
ADMIN_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8000/users | jq -r '.[] | select(.email=="admin@example.com").id')
curl -i -X PATCH "http://localhost:8000/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Migration Sprint v2"}'                                                              # 200 (rename works)

# Activate
curl -i -X PATCH "http://localhost:8000/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"active"}'                                                                         # 200, status:"active"
```

### US5 — developer pushes progress on their own modules; auto-completion

```bash
# Identify Dev1's modules
DEV_MODS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/projects/$PROJECT_ID/progress" \
  | jq '[.modules[] | .id]')

# Dev1 attempts to update a module assigned to Dev2 → 403
DEV2_MOD=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/projects/$PROJECT_ID/progress" \
  | jq '.modules[1].id')
curl -i -X PATCH "http://localhost:8000/modules/$DEV2_MOD/progress" \
  -H "Authorization: Bearer $DEV_TOKEN" -H 'Content-Type: application/json' \
  -d '{"progress":50}'                                                                             # 403

# Dev1 pushes their own module
DEV1_MOD=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/projects/$PROJECT_ID/progress" \
  | jq '.modules[0].id')
curl -X PATCH "http://localhost:8000/modules/$DEV1_MOD/progress" \
  -H "Authorization: Bearer $DEV_TOKEN" -H 'Content-Type: application/json' \
  -d '{"progress":100}'

# Push the third Dev1 module
DEV1_MOD2=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/projects/$PROJECT_ID/progress" \
  | jq '.modules[2].id')
curl -X PATCH "http://localhost:8000/modules/$DEV1_MOD2/progress" \
  -H "Authorization: Bearer $DEV_TOKEN" -H 'Content-Type: application/json' \
  -d '{"progress":100}'

# Dev2 finishes the last → project auto-completes
curl -X PATCH "http://localhost:8000/modules/$DEV2_MOD/progress" \
  -H "Authorization: Bearer $DEV2_TOKEN" -H 'Content-Type: application/json' \
  -d '{"progress":100}'

# Verify
curl -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/projects/$PROJECT_ID" \
  | jq .status                                                                                     # "completed"

# Subsequent progress writes 422 (FR-021)
curl -i -X PATCH "http://localhost:8000/modules/$DEV1_MOD/progress" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"progress":50}'                                                                             # 422
```

### US6 — aggregate progress

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/projects/$PROJECT_ID/progress" \
  | jq                                                                                             # {project_id, progress:100.0, modules:[...]}
```

### US7 — admin soft-deletes a project (or module)

```bash
# Manager DELETE → 403
curl -i -X DELETE "http://localhost:8000/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $MGR_TOKEN"                                                            # 403

# Admin soft-deletes
curl -i -X DELETE "http://localhost:8000/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"                                                          # 204

# Reads return 404
curl -i -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:8000/projects/$PROJECT_ID"      # 404
```

## Step 6 — run the CI audit scripts

```bash
bash backend/scripts/audit_jose_imports.sh
bash backend/scripts/audit_auth_imports.sh
bash backend/scripts/audit_users_imports.sh
bash backend/scripts/audit_clients_imports.sh
bash backend/scripts/audit_projects_imports.sh   # new — FR-027
```

All five must print `OK: …` and exit 0.

## Step 7 — Swagger sanity check

Reload `http://localhost:8000/docs`. Verify each new endpoint matches
`contracts/openapi.yaml`:

- `total_amount`, `share_percentage`, `company_share`, `developer_share`
  serialise as **strings** in responses (Decimal-as-string per R10).
- `ProjectUpdate.status` enum is `["active", null]` only — `completed` and
  `pending` are absent from the schema (FR-014, FR-015).
- `ModuleProgressUpdate` has only the `progress` field (closed schema).
- `ProjectRead.status` enum is the full `[pending, active, completed]`.
- All new endpoints have a `bearerAuth` security requirement.

## Cleanup

```bash
DROP DATABASE progress_tracker_dev;
# or rm backend/dev.sqlite
```

The branch is safe to merge once steps 1–7 all pass.
