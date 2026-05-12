# Phase 1 Data Model: Payments Distribution

**Feature**: `006-payments-distribution`
**Date**: 2026-05-07
**Status**: Complete

## Overview

Two new tables. Both are append-only outside `developer_payment.status`.
All money is `Decimal(12, 2)`; all share percentages are `Decimal(5, 2)`.

## Table: `payment`

| Column            | Type             | Nullable | Default       | Notes                                                                |
| ----------------- | ---------------- | -------- | ------------- | -------------------------------------------------------------------- |
| `id`              | INTEGER          | NO       | autoincrement | PK                                                                    |
| `project_id`      | INTEGER          | NO       | —             | FK `project.id` ON DELETE RESTRICT. Index.                           |
| `total_amount`    | NUMERIC(12, 2)   | NO       | —             | The slice the operator is billing. CHECK > 0.                        |
| `company_amount`  | NUMERIC(12, 2)   | NO       | —             | Derived: `total_amount × 0.30` quantized to 2 dp (banker's rounding). |
| `developer_amount`| NUMERIC(12, 2)   | NO       | —             | Derived: `total_amount × 0.70` quantized to 2 dp (banker's rounding). |
| `status`          | VARCHAR(16)      | NO       | `'pending'`   | Derived from children. CHECK in (`pending`, `partial`, `paid`).      |
| `created_at`      | TIMESTAMP        | NO       | `now()`       | UTC.                                                                  |

**Constraints**:
- PK: `id`
- FK: `project_id → project.id ON DELETE RESTRICT`
- CHECK: `total_amount > 0`
- CHECK: `status IN ('pending', 'partial', 'paid')`

**Indexes**:
- PK on `id` (implicit)
- Index on `project_id` (filter for `GET /payments?project_id=`)

**Mutability**:
- `id`, `project_id`, `total_amount`, `company_amount`, `developer_amount`,
  `created_at` are **immutable post-INSERT** (FR-019).
- `status` is **derived** by service layer; never user-controlled. The
  service writes it on every transition.

**Derivation invariants** (SC-001):
- `company_amount + developer_amount == total_amount` exactly.
- `company_amount = quantize(total_amount × Decimal("0.30"))`.
- `developer_amount = quantize(total_amount × Decimal("0.70"))`.
- If the two derived values do not sum to `total_amount` (rare, e.g.,
  `total = 1.00` → `0.30 + 0.70 = 1.00` ✓; `total = 0.01` →
  `0.00 + 0.01` = drift — guarded at the schema layer by minimum
  `total_amount = 0.01`, but residual goes to `developer_amount`).

## Table: `developer_payment`

| Column              | Type             | Nullable | Default       | Notes                                                                            |
| ------------------- | ---------------- | -------- | ------------- | -------------------------------------------------------------------------------- |
| `id`                | INTEGER          | NO       | autoincrement | PK                                                                                |
| `payment_id`        | INTEGER          | NO       | —             | FK `payment.id` ON DELETE RESTRICT. Index.                                       |
| `developer_id`      | INTEGER          | NO       | —             | FK `user.id` ON DELETE RESTRICT. Frozen at generation. Index.                    |
| `module_id`         | INTEGER          | NO       | —             | FK `project_module.id` ON DELETE RESTRICT. Frozen at generation. Index.          |
| `share_percentage`  | NUMERIC(5, 2)    | NO       | —             | Snapshot of `project_module.share_percentage` at generation. CHECK 0 < x ≤ 70.   |
| `amount`            | NUMERIC(12, 2)   | NO       | —             | The cash slice. CHECK ≥ 0. (Zero only if `share_percentage` is zero — disallowed.) |
| `status`            | VARCHAR(8)       | NO       | `'pending'`   | The only mutable column. CHECK in (`pending`, `paid`).                           |
| `created_at`        | TIMESTAMP        | NO       | `now()`       | UTC.                                                                              |

**Constraints**:
- PK: `id`
- FK: `payment_id → payment.id ON DELETE RESTRICT`
- FK: `developer_id → user.id ON DELETE RESTRICT`
- FK: `module_id → project_module.id ON DELETE RESTRICT`
- CHECK: `share_percentage > 0 AND share_percentage <= 70`
- CHECK: `amount >= 0`
- CHECK: `status IN ('pending', 'paid')`

**Indexes**:
- PK on `id`
- Index on `payment_id` (children-of-parent lookup; status derivation)
- Index on `developer_id` (developer self-service `WHERE developer_id = :caller`)
- Index on `module_id` (audit / future analytics)

**Mutability**:
- `id`, `payment_id`, `developer_id`, `module_id`, `share_percentage`,
  `amount`, `created_at` are **immutable post-INSERT** (FR-018, FR-019).
- `status` is the **only** column the service ever updates — and only
  via the `mark_paid` helper (monotonic: `pending → paid`; no reverse).

## Cross-table invariants

1. **Atomic generation** (R1): the parent INSERT and all child INSERTs
   occur in one transaction. A mid-distribution failure rolls back the
   parent.
2. **Sum invariant** (SC-001): for any Payment,
   `sum(child.amount) == developer_amount`. The largest child absorbs
   the rounding residual to maintain this exactly.
3. **Derived parent status** (R2):
   - all children `pending` → parent `pending`
   - any-but-not-all `paid` → parent `partial`
   - all `paid` → parent `paid`
4. **Frozen snapshot** (R4): `developer_id`, `module_id`,
   `share_percentage`, `amount` reflect the state at generation time
   forever. Subsequent mutations to `project_module` do NOT cascade.

## Distribution algorithm (FR-004 + R3)

```python
def distribute(developer_amount: Decimal,
               modules: list[ProjectModule]) -> list[ChildSlice]:
    """
    Compute per-child amounts.
    
    Pre-conditions:
    - sum(m.share_percentage for m in modules) == Decimal("70.00")
    - all m.is_active and m.assigned_developer_id is not None
    
    Returns list with sum(c.amount) == developer_amount exactly.
    """
    quant = Decimal("0.01")
    children: list[ChildSlice] = []
    for m in modules:
        raw = developer_amount * m.share_percentage / Decimal("70")
        amount = raw.quantize(quant, rounding=ROUND_HALF_EVEN)
        children.append(ChildSlice(module=m, amount=amount))
    
    # Residual absorption: largest share first, ties by developer_id asc.
    residual = developer_amount - sum(c.amount for c in children)
    if residual != 0:
        target = max(
            children,
            key=lambda c: (c.module.share_percentage, -c.module.assigned_developer_id),
        )
        target.amount += residual
    return children
```

## Status derivation function (R2)

```python
def derive_payment_status(children: Iterable[DeveloperPayment]) -> str:
    children = list(children)
    if not children:
        return "pending"  # defensive — generation always writes children
    paid_count = sum(1 for c in children if c.status == "paid")
    if paid_count == len(children):
        return "paid"
    if paid_count == 0:
        return "pending"
    return "partial"
```

## Foreign-key rationale (ON DELETE RESTRICT everywhere)

- `payment.project_id`: a project with Payments cannot be hard-deleted
  (audit-trail durability — SC-005). Soft-delete on the project does
  NOT cascade and does NOT hide the Payment (FR-017).
- `developer_payment.payment_id`: structural integrity — a
  DeveloperPayment without a parent is meaningless.
- `developer_payment.developer_id`: a developer with disbursed Payments
  cannot be hard-deleted. Soft-delete on the user (`is_active=false`)
  does NOT cascade and does NOT hide their earnings (FR-017
  continuation).
- `developer_payment.module_id`: same — historical earnings reference
  the module they were calculated against.

## Migration strategy (alembic revision `20260505_payment`)

- `down_revision = "20260504_project"`
- `upgrade()`:
  - `op.create_table("payment", …)` with the columns + constraints above
  - `op.create_table("developer_payment", …)` likewise
  - `op.create_index("ix_payment_project_id", "payment", ["project_id"])`
  - `op.create_index("ix_developer_payment_payment_id", "developer_payment", ["payment_id"])`
  - `op.create_index("ix_developer_payment_developer_id", "developer_payment", ["developer_id"])`
  - `op.create_index("ix_developer_payment_module_id", "developer_payment", ["module_id"])`
- `downgrade()`:
  - `op.drop_table("developer_payment")` (children first, FK direction)
  - `op.drop_table("payment")`

No data migration. No edits to existing tables.
