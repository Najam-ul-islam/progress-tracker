# Quickstart: Payments Distribution

**Feature**: `006-payments-distribution`
**Date**: 2026-05-07

This walk-through assumes you have already:

1. Run the alembic migration up to `20260505_payment`.
2. Seeded an admin (`alice` / `secret123`), a manager (`mike`), and a
   developer (`devon`) via feature 002.
3. Created a client and an active project with two modules (shares
   `40` and `30`, summing to `70`) via features 004 / 005.

## 0. Login (continuity from feature 002)

```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "secret123"}' \
  | python -c "import json, sys; print(json.load(sys.stdin)['access_token'])")

DEV_TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "devon", "password": "secret123"}' \
  | python -c "import json, sys; print(json.load(sys.stdin)['access_token'])")
```

## 1. Generate a Payment (admin or manager — US1)

```bash
curl -s -X POST "http://localhost:8000/payments/generate/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"total_amount": "10000.00"}'
```

Expected response (HTTP 201):

```json
{
  "id": 1,
  "project_id": 1,
  "total_amount": "10000.00",
  "company_amount": "3000.00",
  "developer_amount": "7000.00",
  "status": "pending",
  "created_at": "2026-05-07T12:00:00",
  "developer_breakdown": [
    {
      "id": 1,
      "payment_id": 1,
      "developer_id": 3,
      "module_id": 1,
      "share_percentage": "40.00",
      "amount": "4000.00",
      "status": "pending",
      "created_at": "2026-05-07T12:00:00"
    },
    {
      "id": 2,
      "payment_id": 1,
      "developer_id": 4,
      "module_id": 2,
      "share_percentage": "30.00",
      "amount": "3000.00",
      "status": "pending",
      "created_at": "2026-05-07T12:00:00"
    }
  ]
}
```

Note: `company_amount + developer_amount == total_amount` exactly, and
the two child amounts sum to `developer_amount` exactly (SC-001).

## 2. List all Payments (admin or manager — US2)

```bash
curl -s "http://localhost:8000/payments" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Filter by project:

```bash
curl -s "http://localhost:8000/payments?project_id=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 3. Read one Payment with breakdown (admin or manager — US2)

```bash
curl -s "http://localhost:8000/payments/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Returns the same shape as the generation response.

## 4. Developer self-service (developer only — US3)

```bash
curl -s "http://localhost:8000/payments/developer/me" \
  -H "Authorization: Bearer $DEV_TOKEN"
```

Expected response (HTTP 200):

```json
[
  {
    "id": 1,
    "payment_id": 1,
    "developer_id": 3,
    "module_id": 1,
    "project_id": 1,
    "share_percentage": "40.00",
    "amount": "4000.00",
    "status": "pending",
    "created_at": "2026-05-07T12:00:00"
  }
]
```

The developer sees **only** their own row. They never see the company
reserve or other developers' amounts (FR-008).

## 5. Mark one child paid (admin only — US4)

```bash
curl -s -X PATCH "http://localhost:8000/payments/1/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"developer_payment_id": 1}'
```

Response: parent `Payment.status` is now `partial` (one of two children
is paid).

## 6. Mark all remaining children paid (admin only — US4)

```bash
curl -s -X PATCH "http://localhost:8000/payments/1/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target": "all"}'
```

Response: every child is now `paid`; parent is `paid`.

## 7. Aggregate summary (admin or manager — US5)

```bash
curl -s "http://localhost:8000/payments/summary" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected response (HTTP 200):

```json
{
  "total_billed": "10000.00",
  "total_company_reserve": "3000.00",
  "total_developer_disbursed": "7000.00",
  "by_status": {
    "pending": {"count": 0, "sum": "0.00"},
    "partial": {"count": 0, "sum": "0.00"},
    "paid": {"count": 1, "sum": "10000.00"}
  }
}
```

## Common error responses

### Project not yet active (FR-001)

```bash
curl -s -X POST "http://localhost:8000/payments/generate/2" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"total_amount": "5000.00"}'
# HTTP 422
# {"detail": "project is not yet active"}
```

### Module shares no longer sum to 70 (FR-005)

If a module is soft-deleted between activation and generation:

```bash
curl -s -X POST "http://localhost:8000/payments/generate/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"total_amount": "10000.00"}'
# HTTP 422
# {"detail": "module shares no longer sum to 70.00"}
```

### Mutually exclusive fields (FR-012)

```bash
curl -s -X PATCH "http://localhost:8000/payments/1/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"developer_payment_id": 1, "target": "all"}'
# HTTP 422
# {"detail": "developer_payment_id and target are mutually exclusive"}
```

### Developer trying to read aggregates (FR-006)

```bash
curl -s "http://localhost:8000/payments" \
  -H "Authorization: Bearer $DEV_TOKEN"
# HTTP 403
```

### Admin trying to use the developer endpoint (FR-007)

```bash
curl -s "http://localhost:8000/payments/developer/me" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# HTTP 403
```

## Verifying the sum invariant (SC-001)

For any Payment, two equalities must hold:

```python
assert payment.company_amount + payment.developer_amount == payment.total_amount
assert sum(c.amount for c in payment.developer_breakdown) == payment.developer_amount
```

Both are property-tested in `test_payments_generate.py` across at least
three (`total_amount`, share-split) combinations including a case
designed to force a rounding residual (e.g.,
`total_amount = "100.01", shares = [40, 30]`).
