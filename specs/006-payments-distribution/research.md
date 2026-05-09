# Phase 0 Research: Payments Distribution

**Feature**: `006-payments-distribution`
**Date**: 2026-05-07
**Status**: Complete (no [NEEDS CLARIFICATION] markers remain)

## Purpose

Resolve every technical decision required by the spec **before** Phase 1
design. Each decision below records: the choice taken, why, and the
alternatives considered. The choices are referenced from `plan.md` by
their R-number.

## R1 — Atomic generation: parent + children in one transaction

**Decision**: Wrap the parent `Payment` INSERT and the N
`DeveloperPayment` INSERTs in a single SQLModel `Session` transaction.
Use the FastAPI request-scoped session (`get_session` yields a session
configured with `autocommit=False`). On any exception during the loop,
the session's `rollback()` removes the parent row before the request
returns 5xx.

**Rationale**:
- SC-001 demands `sum(child.amount) == developer_amount` exactly for
  every Payment. A partial write (parent persisted, children missing or
  short) would silently break this invariant and require manual cleanup.
- The "atomic in one transaction" pattern is already in use in
  `projects.service.create_project` (where `Project` and the implicit
  audit columns are written together). We mirror it.
- SQLite + Postgres both honour transaction rollback on exception.
- Latency cost is negligible: at ≤10 children, the round-trip is one
  COMMIT instead of N+1.

**Alternatives considered**:
- *Two-phase write* (insert parent, loop inserting children, retry on
  child failure). Rejected: leaves partial-Payment rows on hard
  failures (process kill, DB outage); requires a sweep job to find and
  delete them.
- *Event-sourced pair* (emit `PaymentRequested`, then `PaymentDistributed`
  in a follow-up worker). Rejected: out of scope — there is no event
  bus in the project today; would require new infrastructure for a
  problem the transaction already solves.
- *Two-step API* (`POST /payments/draft`, then `POST /payments/{id}/finalise`).
  Rejected: doubles the surface area; the spec deliberately models a
  single atomic generation call.

## R2 — Status state machine: derived from children, not operator-set

**Decision**: `Payment.status` is computed by a pure function over the
children:

```python
def derive_status(children: list[DeveloperPayment]) -> str:
    if all(c.status == "paid" for c in children):
        return "paid"
    if any(c.status == "paid" for c in children):
        return "partial"
    return "pending"
```

`PATCH /payments/{id}/status` flips one or more child rows from
`pending` to `paid`, then re-derives and writes the parent's `status`
inside the same transaction.

**Rationale**:
- The operator should never be able to set `Payment.status = "paid"`
  while children remain `pending` — that would lie about disbursement
  state. By making `status` a function of the children, the lie is
  unrepresentable.
- The schema is correspondingly stricter: `PaymentStatusPatch` has no
  `status` field. The only writable values are `developer_payment_id`
  and `target` (mutually exclusive).
- Idempotency falls out for free: re-PATCHing `target=all` on an
  already-paid Payment is a no-op (every child is already paid; the
  derivation produces `paid` again).

**Alternatives considered**:
- *Operator-settable status with validation* (`pending → partial → paid`,
  reject backwards). Rejected: gives the operator a footgun; lets the
  parent state diverge from children if a future bug skips the
  validation; doubles the test matrix.
- *Two PATCH endpoints* (one for child, one for parent). Rejected:
  parent endpoint adds no value because the parent is derived; only
  doubles the surface to test.
- *Database trigger* on `developer_payment` UPDATE to recompute parent.
  Rejected: SQLite test database support for triggers is uneven; logic
  becomes invisible to readers of the service layer.

## R3 — Decimal arithmetic + banker's rounding + residual absorption

**Decision**: All money arithmetic uses `decimal.Decimal`. The 30/70
split is computed as `total_amount × Decimal("0.30")` and
`total_amount × Decimal("0.70")`, both quantized to two decimal places
using `ROUND_HALF_EVEN` (banker's rounding). Per-child amounts are
computed as `developer_amount × share_percentage / Decimal("70")`,
quantized the same way. The rounding residual
(`developer_amount - sum(child_amounts)`) is added to the largest child
(ties broken by `developer_id` ascending) so children sum exactly.

**Rationale**:
- SC-001: `company_amount + developer_amount == total_amount` and
  `sum(child.amount) == developer_amount`, exactly. No float can satisfy
  this; only Decimal can.
- Banker's rounding is the IEEE 754 / GAAP-friendly default. It avoids
  the systematic upward bias of half-up rounding when many small slices
  are summed.
- Residual absorption ensures no penny is lost: if three children each
  get `2333.333...` and round to `2333.33`, the developer_amount of
  `7000.00` would otherwise sum to `6999.99`; the largest child gets
  `2333.34` instead.
- Largest-share first (ties by `developer_id` ascending) is
  deterministic and reproducible across runs and across environments.

**Alternatives considered**:
- *Per-row half-up rounding, accept drift*. Rejected: SC-001 forbids
  drift; would require a "rounding adjustment" line item.
- *Drop the cent*. Rejected: short-changes one developer per generation
  (small amount × many generations × many years = lawsuit material).
- *Carry forward the residual to the next Payment*. Rejected: each
  Payment is independent (FR-002 milestones); cross-Payment state
  defeats the audit-trail invariant.

## R4 — Frozen referential snapshot at generation time

**Decision**: At generation, the service captures the active set of
modules and their `share_percentage` and `assigned_developer_id`,
computes amounts, and writes child rows. The child rows store
`developer_id`, `module_id`, `share_percentage`, and `amount` as
**frozen values**. Subsequent edits to the source `project_module`
(re-assigning the developer, changing the share) MUST NOT recompute
historical Payments.

**Rationale**:
- FR-018: historical earnings are an immutable audit trail.
- A developer who saw `"4000.00"` in `GET /payments/developer/me` last
  Tuesday must still see `"4000.00"` next Tuesday, even if the module
  was re-assigned in between.
- The implementation cost is negligible: the amount is already stored
  on the row (it's the cash to disburse). The `share_percentage` is
  added because future audits will want to verify "what was the
  module's share at the time?" without joining the projects table.

**Alternatives considered**:
- *Recompute on read*. Rejected: violates FR-018; makes the developer's
  view non-deterministic across time.
- *Store only `module_id` + `developer_id`, derive `amount` and
  `share_percentage` from the module on read*. Rejected: same problem;
  also fails when a module is soft-deleted.

## R5 — Test database: SQLite-in-memory + StaticPool (continuity)

**Decision**: Reuse the existing `backend/tests/conftest.py` setup —
SQLite in-memory engine with `StaticPool` and `connect_args={"check_same_thread": False}`,
session factory bound, FastAPI dependency override of `get_session`. Add
one import line so `create_all` picks up the new `Payment` and
`DeveloperPayment` tables.

**Rationale**:
- Identical to features 002 / 003 / 004 / 005. Tests run in the same
  test process; no extra infra.
- Both `Numeric(12,2)` and `ON DELETE RESTRICT` work on SQLite via
  SQLAlchemy.
- Adding the import is a one-line edit; the rest of the conftest is
  unchanged.

**Alternatives considered**:
- *Postgres test container*. Rejected: out of scope for the MVP; would
  add ~5s startup to every CI run.
- *Mock the repository*. Rejected: this feature's invariants
  (atomicity, status derivation, FK RESTRICT) are exactly the things a
  mock would lie about.

## R6 — Audit script for FR-023 (sibling import allow-list)

**Decision**: Add `backend/scripts/audit_payments_imports.sh` mirroring
`audit_projects_imports.sh`. Allow-list:
`projects.repository`, `users.repository`, `auth.dependencies`,
`auth.schema`. The script greps the payments module for any other
`from app.modules.X import …` and exits non-zero on a hit.

Two import forms must be matched:
- `from app.modules.X.repository import …` (sub-symbol form)
- `from app.modules.X import repository` (module-as-symbol form)

**Rationale**:
- FR-023 is a hard boundary; it deserves a CI gate, not a code-review
  gate.
- `audit_projects_imports.sh` already covers both forms after the
  feature 005 fix; we reuse the same regex.

**Alternatives considered**:
- *Python-level enforcement* (decorate the modules with a metaclass
  check). Rejected: heavyweight; runs at import time; can be bypassed
  by direct attribute access.
- *Lint rule* (e.g., flake8 plugin). Rejected: adds a dependency
  for a single one-line check.

## R7 — Concurrency: two operators race to generate Payments

**Decision**: Both succeed (FR-002 — milestones). The resulting
Payments differ by `id` and `created_at`. No advisory lock, no
SELECT FOR UPDATE on the project row, no idempotency token.

**Rationale**:
- The spec explicitly permits multiple Payments per project (milestone
  billing). Concurrent generation is the same case as sequential
  generation with overlapping timestamps.
- The 70%-share verification reads the same active module set in both
  transactions; both will see consistent data because the
  `project_module` table is not being mutated by either Payment
  request.

**Alternatives considered**:
- *Idempotency token in request body*. Rejected: not in spec; would
  require a fingerprint column on `payment` and a UNIQUE index.
- *Pessimistic lock on the project row*. Rejected: serialises milestone
  billing for no benefit; the operations are commutative.

## R8 — RBAC: three layered guards

**Decision**: Reuse `auth.dependencies`:
- `Depends(get_current_user)` enforces 401.
- `Depends(require_admin)` for `PATCH /payments/{id}/status`.
- `Depends(require_any("admin", "manager"))` for generate / list /
  read-aggregate / summary.
- `Depends(require_role("developer"))` for `GET /payments/developer/me`.

These dependencies handle 401 (via `get_current_user`) and 403 (via the
role guards). The 404 (missing target) and 422 (validation) checks fall
through to the service layer. This preserves the
401-then-403-then-404-then-422 ordering (FR-016, continuity).

**Rationale**:
- Existing pattern from features 003 / 004 / 005; do not invent a new
  one.
- The developer-scoped endpoint deliberately rejects admin/manager
  with 403 — the endpoint shape (per-row, no project totals) is wrong
  for them; they have `/payments/{id}` instead.

**Alternatives considered**:
- *Service-layer-only RBAC*. Rejected: violates continuity;
  `Depends`-based gates are the established pattern.
- *Single Depends factory that takes a role list*. Rejected: not
  worth the abstraction for four call sites.

## R9 — Logging strategy

**Decision**: Two structured INFO-level log lines (FR-021):

- On generation:
  `payments.generate: payment_id={id} project_id={pid} total={total} children={n}`
- On status transition:
  `payments.status: payment_id={id} developer_payment_id={cid} new_status=paid parent_status={pstatus}`

Use the standard library `logging` module with a module-level logger
named `app.modules.payments.service`. No structured-log JSON for now;
the project uses plain-text logs in dev (consistent with auth/projects).

**Rationale**:
- Matches the pattern in `auth.service` and `projects.service`.
- INFO-level keeps the lines visible in default dev output but lets a
  prod operator drop the verbosity to WARNING if needed.

**Alternatives considered**:
- *Audit log table in the database*. Rejected: out of scope; the
  Payment table itself is already the audit trail.
- *Emit a webhook*. Rejected: adds a new dependency / failure mode for
  no spec'd value.

## R10 — Decimal serialisation: string on the wire

**Decision**: Money fields (`total_amount`, `company_amount`,
`developer_amount`, `amount`, `share_percentage`, summary sums) are
serialised as JSON strings on the wire. Pydantic v2's default for
`Decimal` is to emit a string; we keep that default.

**Rationale**:
- IEEE 754 doubles cannot represent `0.10` exactly; round-tripping a
  Decimal through JSON `number` would re-introduce the float drift the
  Decimal arithmetic is designed to avoid.
- Continuity with feature 005's R10 / decimal-as-string ADR
  suggestion.

**Alternatives considered**:
- *JSON number*. Rejected: float drift on the consumer side defeats
  SC-001.
- *Custom JSON encoder that emits a typed object* (`{"$decimal": "70.00"}`).
  Rejected: non-standard; consumer libraries don't support it.
