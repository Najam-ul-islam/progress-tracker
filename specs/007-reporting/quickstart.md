# Quickstart: Reporting & Analytics

**Feature**: `007-reporting`
**Date**: 2026-05-08

This walk-through assumes you have already:

1. Run all alembic migrations through `20260505_payment` (feature 006).
2. Seeded an admin (`alice`), a manager (`mike`), a developer (`devon`) via feature 002.
3. Generated at least one Payment via feature 006 so the reports have data to aggregate.

No new migrations are required for reporting.

## 0. Login (continuity from feature 002)

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "secret123"}' \
  | python -c "import json, sys; print(json.load(sys.stdin)['access_token'])")

MANAGER_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "mike", "password": "secret123"}' \
  | python -c "import json, sys; print(json.load(sys.stdin)['access_token'])")

DEV_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "devon", "password": "secret123"}' \
  | python -c "import json, sys; print(json.load(sys.stdin)['access_token'])")
```

## 1. Operations dashboard (admin or manager — US1)

```bash
curl -s "http://localhost:8000/reports/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected response (HTTP 200):

```json
{
  "projects": {
    "total": 4,
    "pending": 1,
    "active": 2,
    "completed": 1,
    "overdue": 0
  },
  "developers": {
    "total": 3,
    "with_active_assignments": 2,
    "average_module_progress": "55.0"
  },
  "payments": {
    "total_revenue": "10000.00",
    "total_company_reserve": "3000.00",
    "total_developer_disbursed": "7000.00",
    "pending_amount": "0.00"
  }
}
```

The dashboard never accepts filters (it always reflects "now"). Soft-deleted projects and modules are excluded from operational counts.

## 2. Per-project report (admin or manager — US2)

Unfiltered:

```bash
curl -s "http://localhost:8000/reports/projects" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Filtered by status:

```bash
curl -s "http://localhost:8000/reports/projects?project_status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Filtered by client and date range:

```bash
curl -s "http://localhost:8000/reports/projects?client_id=1&date_from=2026-05-01&date_to=2026-05-31" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Each row exposes overall progress (share-weighted), module list with assigned developer names, and invoiced/outstanding amounts.

## 3. Per-developer report (admin or manager — US3)

```bash
curl -s "http://localhost:8000/reports/developers" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Filter to one developer:

```bash
curl -s "http://localhost:8000/reports/developers?developer_id=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Each row exposes module load split (completed / in_progress / pending), earnings (paid/pending/total), and a `earnings_by_project` chart-ready breakdown.

## 4. Financial report (admin or manager — US4)

```bash
curl -s "http://localhost:8000/reports/payments" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Returns per-project rows (one per project in scope, including those with zero payments) plus a `totals` block. The manager role is allowed because `/reports/payments` is part of payment analytics under the RBAC contract.

## 5. Developer self-service (developer only — US5)

```bash
curl -s "http://localhost:8000/reports/developers/me" \
  -H "Authorization: Bearer $DEV_TOKEN"
```

Expected response (HTTP 200):

```json
{
  "id": 3,
  "name": "Devon",
  "module_count": 2,
  "modules_completed": 1,
  "modules_in_progress": 1,
  "modules_pending": 0,
  "earnings": {
    "paid": "400.00",
    "pending": "0.00",
    "total": "400.00"
  },
  "modules": [
    {
      "module_id": 1,
      "module_name": "auth-flow",
      "project_id": 1,
      "project_name": "Acme Portal",
      "progress": 100,
      "status": "completed",
      "share_percentage": "40.00",
      "amount_paid": "400.00",
      "amount_pending": "0.00"
    }
  ]
}
```

Admins and managers hitting this endpoint receive 403 (FR-006). A developer with no assignments gets a structurally complete payload with zeros and an empty `modules` list.

## Common error responses

### Bad date range (FR-017)

```bash
curl -s "http://localhost:8000/reports/projects?date_from=2026-06-01&date_to=2026-05-01" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# HTTP 422
# {"detail": "date_from must be on or before date_to"}
```

### Unknown project_status (FR-018)

```bash
curl -s "http://localhost:8000/reports/projects?project_status=archived" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# HTTP 422
# {"detail": "project_status must be one of: pending, active, completed"}
```

### Unknown client_id (FR-019)

```bash
curl -s "http://localhost:8000/reports/projects?client_id=9999" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# HTTP 422
# {"detail": "client_id 9999 not found"}
```

### Developer trying to read aggregates (FR-006)

```bash
curl -s "http://localhost:8000/reports/dashboard" \
  -H "Authorization: Bearer $DEV_TOKEN"
# HTTP 403
```

### Admin trying to use the developer self-service endpoint (FR-006)

```bash
curl -s "http://localhost:8000/reports/developers/me" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# HTTP 403
```

## Smoke verification

After deploy, verify every endpoint exists and is wired:

```bash
curl -s "http://localhost:8000/openapi.json" \
  | python -c "import json,sys; print('\n'.join(sorted(p for p in json.load(sys.stdin)['paths'] if p.startswith('/reports'))))"
```

Should print exactly five lines:

```text
/reports/dashboard
/reports/developers
/reports/developers/me
/reports/payments
/reports/projects
```
