# Implementation Plan: Payments Distribution

**Branch**: `006-payments-distribution` | **Date**: 2026-05-07 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/006-payments-distribution/spec.md`

## Summary

Stand up the `payments` module: a six-file modular slice that owns two new
SQLModels — `Payment` and `DeveloperPayment` — and exposes seven HTTP
endpoints under `/payments` with the RBAC matrix `admin = full`,
`manager = generate + read aggregate + summary`,
`developer = read own earnings only`. Persist a closed `Payment` shape
(7 columns) and `DeveloperPayment` shape (8 columns) in a single new
alembic revision (`20260505_payment`) chained on `20260504_project`, with
foreign keys `payment.project_id → project.id`,
`developer_payment.payment_id → payment.id`,
`developer_payment.developer_id → user.id`, and
`developer_payment.module_id → project_module.id`, all with
`ON DELETE RESTRICT`. The 30/70 split, per-child distribution, and
banker's-rounding residual absorption are enforced at the service layer
in a single atomic transaction (parent + children written together; mid-
distribution failure rolls back the parent). The status state machine is
**derived**: every `PATCH /payments/{id}/status` flips one or more child
rows from `pending` to `paid`, then re-derives `Payment.status` from the
children (every child pending → `pending`; some-but-not-all paid →
`partial`; every child paid → `paid`). Add one CI audit script
(`audit_payments_imports.sh`) that fails the build if `payments/**.py`
imports business logic from any sibling beyond the FR-023 allow-list
(`projects.repository`, `users.repository`, `auth.dependencies`,
`auth.schema`).

**Technical approach** (validated in [`research.md`](./research.md)):

- Six-file modular layout under `backend/app/modules/payments/`. All six
  files exist as empty stubs; this feature **fills** five
  (`model / schema / repository / service / routes`) and leaves
  `dependencies.py` empty (no payments-specific FastAPI Depends() factory
  beyond what `auth.dependencies` already provides).
- New `Payment` and `DeveloperPayment` SQLModels are the single source of
  truth. The `Payment` table is an append-only audit ledger; the only
  mutating column on either table is `DeveloperPayment.status`.
- Reuse `auth.dependencies.{get_current_user, require_admin, require_any}`
  for authentication / role gates. Per-row visibility (developer-sees-only-
  their-own-DeveloperPayment-rows) is enforced in the service layer's
  `list_for_developer` query (`WHERE developer_id = :caller_id`).
- Cross-module reads only: `projects.repository.get_project_by_id` for
  FR-001 (project must exist + be active|completed at generation time);
  `projects.repository.list_active_modules` for FR-004/FR-005 (snapshot
  the active module set + verify shares still sum to 70.00);
  `users.repository.get_user_by_id` for FR-018 (frozen developer FK
  validity at generation). All three are read-only; all three are
  explicitly allow-listed in `audit_payments_imports.sh`.
- Test surface: SQLite-in-mem `TestClient` with
  `dependency_overrides[get_session]`, reusing the conftest fixtures
  already present (`seed_admin / seed_manager / seed_developer / make_token
  / auth_header / seed_client / seed_project_active_with_modules`). One
  new fixture added: `seed_payment_for_project` (used by US2/US3/US4/US5).

## Technical Context

**Language/Version**: Python 3.13.

**Primary Dependencies** (already installed — no additions):

- `fastapi`, `sqlmodel`, `pydantic` v2, `pydantic-settings`.
- `sqlalchemy` (transitive) — for `ForeignKey(... ondelete="RESTRICT")`,
  `Numeric(12,2)`, and `CheckConstraint`.
- `alembic` — single new revision `20260505_payment`.
- `python-jose`, `passlib[bcrypt]` — **not imported here**; consumed only
  via `auth.dependencies` (preserves SC-006 / SC-007 of feature 002).

**Decimal arithmetic**: standard library `decimal`. Banker's rounding
(`ROUND_HALF_EVEN`) is the default for `Decimal.quantize(Decimal("0.01"))`.
The cap-equality check (`sum == Decimal("70.00")`) and the per-child
distribution (`developer_amount × share / 70`) both use Decimal to avoid
float drift. The largest child absorbs the rounding residual so children
sum exactly to `developer_amount` (R3 / FR-004).

**Test deps** (already present): `pytest`, `pytest-asyncio`, `httpx`.

**Storage**: PostgreSQL via `psycopg2-binary` for dev/prod; SQLite in-memory
+ `StaticPool` for tests. Both engines support `Numeric(12,2)`,
`CheckConstraint`, and `ForeignKey(... ondelete="RESTRICT")`.

**Testing**: `pytest` + FastAPI `TestClient`. Five new test files mapping
1:1 to user stories:

- `test_payments_generate.py` (US1 — ≥10 cases, FR-001..005, FR-010, FR-018)
- `test_payments_read.py` (US2 — ≥6 cases, FR-006, list + per-id read)
- `test_payments_developer_me.py` (US3 — ≥6 cases, FR-007, FR-008, FR-014)
- `test_payments_status.py` (US4 — ≥8 cases, FR-011, FR-012, mark-paid path)
- `test_payments_summary.py` (US5 — ≥3 cases, FR-020, summary aggregates)

**Target Platform**: Linux server (containerised) for prod; Windows 10 +
native Python for dev.

**Project Type**: web-application backend (`backend/`). This feature only
touches `backend/`.

**Performance Goals**: 95th percentile of `POST /payments/generate/{id}`
under 1 second for ≤10 active modules (SC-002). Hot paths: project lookup
(indexed PK), share-sum verification (indexed COUNT/SUM on `project_id` +
`is_active`), atomic write (1 INSERT for parent + N INSERTs for children
in a single transaction). No hashing, no token signing, no external I/O.

**Constraints**:

- **uv-only** for dependency and runtime usage. (Memory entry: "Project:
  progress-tracker uses uv only".)
- **Non-destructive integration**: existing modules (`auth`, `users`,
  `clients`, `projects`) MUST keep importing cleanly. Files outside
  `payments/` touched by this feature: one alembic revision, one new
  audit script, one one-line `conftest.py` import. **`app/main.py` is
  unchanged** — `payments` is already in `MODULE_REGISTRY` at `/payments`.
- **No business logic in routes**; routes call services only.
- **Six-file layout per module** is mandatory.
- **Module boundaries** (FR-023): `payments` may import only
  `projects.repository`, `users.repository`, `auth.dependencies`, and
  `auth.schema`. The audit script encodes the allow-list.
- **Append-only ledger**: outside the status PATCH, no endpoint may
  mutate any row in either table (FR-019). The schema layer enforces
  this by omitting any "PaymentUpdate" or "DeveloperPaymentUpdate" types
  entirely; the service layer enforces it by exposing no update helpers
  beyond `mark_child_paid`.

**Scale/Scope**: ≤ a few thousand Payments in the medium term; ≤ a few
tens of thousands of DeveloperPayments. Three RBAC roles: `admin`,
`manager`, `developer`. No pagination on day one.

## Constitution Check

The constitution at `.specify/memory/constitution.md` is still a template
(no enforced rules). In place of formal gates, this plan is held to the
**default policies** in `CLAUDE.md` and to continuity with the
auth/users/clients/projects plans:

| Default policy                                                    | Status      | Evidence                                                                                                                                                                |
| ----------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smallest viable diff; no unrelated refactors                      | ✅ Pass     | Edits confined to `app/modules/payments/**`, one alembic revision, one new audit script, one conftest line, and the test suite. No edits to `auth`, `users`, `clients`, `projects`, `core`, or `db`. |
| Don't invent APIs / contracts; clarify if missing                 | ✅ Pass     | All seven endpoints enumerated in spec; contracts in `contracts/openapi.yaml` are 1:1 with US1–US5 acceptance scenarios. Resolved Decisions block in `spec.md` records generation-gate, milestone-cardinality, and derived-status. |
| No hardcoded secrets; secrets via `.env`                          | ✅ Pass     | This feature adds zero new secrets. No env-coupled behaviour.                                                                                                            |
| Cite existing code; new code in fences                            | ✅ Pass     | Plan references `backend/app/main.py:18-28` (MODULE_REGISTRY), `backend/app/modules/auth/dependencies.py`, `backend/app/modules/projects/repository.py`, `backend/app/modules/users/repository.py`. |
| Six-file modular layout                                           | ✅ Pass     | All six files exist for `payments/`; this feature fills five and leaves `dependencies.py` empty.                                                                         |
| ADR-0003 spirit (one entity, one module)                          | ✅ Pass     | `Payment` and `DeveloperPayment` SQLModels live only in `payments/model.py`. SC-007 verifies via grep.                                                                   |
| SC-006 (jose only in `core.security`)                             | ✅ Pass     | Payments module imports zero JWT or bcrypt symbols.                                                                                                                      |
| FR-027 (feature 005) sibling allow-list direction                 | ✅ Pass     | This feature mirrors that rule for itself (FR-023) — payments can only read `projects.repository`, `users.repository`, `auth.dependencies`, `auth.schema`.               |

## Project Structure

### Documentation (this feature)

```text
specs/006-payments-distribution/
├── spec.md                       # already exists (input)
├── plan.md                       # this file (/sp.plan output)
├── research.md                   # Phase 0 output
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/
│   ├── openapi.yaml              # Phase 1 — HTTP contract for the seven /payments endpoints
│   └── access-control-matrix.md  # Phase 1 — internal RBAC contract
├── checklists/
│   └── requirements.md           # already exists (spec-quality checklist)
└── tasks.md                      # Phase 2 output (/sp.tasks)
```

### Source Code (repository root)

```text
backend/
├── alembic/
│   └── versions/
│       ├── 20260502_create_user_table.py                       # already exists
│       ├── 20260503_add_is_active_and_updated_at_to_user.py    # already exists
│       ├── 20260504_create_client_table.py                     # already exists (feature 004)
│       ├── 20260504_create_project_table.py                    # already exists (feature 005)
│       └── 20260505_create_payment_table.py                    # NEW — Phase 2 task
├── app/
│   ├── main.py                                                 # unchanged — payments router already mounted at /payments
│   ├── core/                                                   # unchanged
│   ├── db/                                                     # unchanged
│   └── modules/
│       ├── auth/                                               # unchanged
│       ├── users/                                              # unchanged
│       ├── clients/                                            # unchanged
│       ├── projects/                                           # unchanged
│       └── payments/
│           ├── __init__.py                                     # unchanged
│           ├── model.py                                        # IMPLEMENT — Payment + DeveloperPayment SQLModels
│           ├── schema.py                                       # IMPLEMENT — PaymentGenerateRequest, PaymentRead, PaymentDetailRead, DeveloperPaymentRead, DeveloperPaymentMineRead, PaymentStatusPatch, PaymentSummaryRead
│           ├── repository.py                                   # IMPLEMENT — DB-only helpers (insert_payment_with_children, get_payment, list_payments[?project_id], get_developer_payment, list_developer_payments_for_user, list_payment_children, mark_developer_payment_paid, summary_aggregates)
│           ├── service.py                                      # IMPLEMENT — typed exceptions + business rules (gen-gate, share-sum guard, 30/70 split, banker's rounding + residual absorption, atomic write, status derivation, RBAC guards)
│           ├── routes.py                                       # IMPLEMENT — 7 endpoints
│           └── dependencies.py                                 # unchanged (empty stub — no payments-specific Depends needed)
├── scripts/
│   ├── audit_jose_imports.sh                                   # unchanged
│   ├── audit_auth_imports.sh                                   # unchanged
│   ├── audit_users_imports.sh                                  # unchanged
│   ├── audit_clients_imports.sh                                # unchanged
│   ├── audit_projects_imports.sh                               # unchanged
│   └── audit_payments_imports.sh                               # NEW — FR-023 enforcement
├── tests/
│   ├── conftest.py                                             # ONE-LINE EDIT — import Payment, DeveloperPayment so create_all picks them up
│   ├── _payments_helpers.py                                    # NEW — seed_payment_for_project + assertion helpers
│   ├── test_payments_generate.py                               # NEW — US1
│   ├── test_payments_read.py                                   # NEW — US2 (list + per-id read; developer 403)
│   ├── test_payments_developer_me.py                           # NEW — US3 (per-row confidentiality + soft-delete durability)
│   ├── test_payments_status.py                                 # NEW — US4 (per-child + target=all; status derivation)
│   └── test_payments_summary.py                                # NEW — US5 (aggregate sums + by-status)
└── pyproject.toml                                              # unchanged (no new deps)
```

**Structure Decision**: monorepo `backend/`. The payments feature lives
entirely under `backend/app/modules/payments/` plus one alembic revision,
one audit script, one conftest import line, one helper module, and five
test files. The existing module-registry in `backend/app/main.py:18-28`
already mounts the payments router at `/payments`; **only one prefix is
needed** (no dual-router pattern like projects/modules). The seven
endpoints all live on the same `router`.

## Phase 0 → Phase 1 outputs

| Artifact            | Path                                                                  | Status       |
| ------------------- | --------------------------------------------------------------------- | ------------ |
| Research            | `specs/006-payments-distribution/research.md`                         | ✅ Complete  |
| Data model          | `specs/006-payments-distribution/data-model.md`                       | ✅ Complete  |
| HTTP contracts      | `specs/006-payments-distribution/contracts/openapi.yaml`              | ✅ Complete  |
| Internal contracts  | `specs/006-payments-distribution/contracts/access-control-matrix.md`  | ✅ Complete  |
| Quickstart          | `specs/006-payments-distribution/quickstart.md`                       | ✅ Complete  |
| Spec-quality checklist | `specs/006-payments-distribution/checklists/requirements.md`       | ✅ Complete (from /sp.specify) |
| Agent context update| `CLAUDE.md` (preserved manual sections)                               | ⏭️ Skipped — no new tech introduced (Decimal + atomic transaction are stdlib + SQLModel default). |

## Re-evaluated Constitution Check (post-design)

No new violations introduced by Phase 1 design. Specifically:

- The single new alembic revision is forward-compatible: it creates two
  brand-new tables with no `data_seed`, no migration of existing rows, and
  no edits to the existing `client` / `user` / `project` / `project_module`
  tables. CHECK constraints on `total_amount > 0`, `status IN (...)`, and
  `share_percentage BETWEEN 0 AND 100` run on both Postgres and SQLite.
- The audit script `audit_payments_imports.sh` reinforces module
  boundaries from the payments-side. It introduces no new pattern, only a
  new enforcement point (mirror of `audit_projects_imports.sh` with
  per-feature allow-list).
- Cross-module reads (`projects.repository.get_project_by_id`,
  `projects.repository.list_active_modules`,
  `users.repository.get_user_by_id`) are explicitly permitted in FR-023
  and are encoded in the audit script's allow-list. They do not import
  business logic — only DB-only helpers.
- The append-only ledger is enforced by **omission, not by a runtime
  check**: there is no `PaymentUpdate` schema, no `update_payment`
  repository helper, and no `PATCH /payments/{id}` route. The single
  mutating endpoint (`PATCH /payments/{id}/status`) only flips child
  rows' `status` and re-derives the parent's `status`; neither is
  user-controlled.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

*(none — section intentionally left empty)*

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

## Architectural Decision suggestions

The following Phase 1 choices pass the three-part ADR significance test
(long-term impact + multiple alternatives + cross-cutting scope):

1. **Atomic generation in a single transaction (parent + N children
   written together; mid-distribution failure rolls back the parent).**
   Alternatives — two-phase write (insert parent, then loop inserting
   children with retries), event-sourced "PaymentRequested → Distributed"
   pair, separate API call to "finalise" a draft Payment — were
   considered and rejected (R1). Long-term impact: every future code
   path that creates a Payment must use the same atomic helper; partial
   Payment rows must never exist in the database.

   📋 Architectural decision detected: atomic Payment generation.
   Document reasoning and tradeoffs? Run
   `/sp.adr payments-atomic-generation`.

2. **Derived parent status (no operator-settable Payment.status).**
   Alternatives — operator-settable status with validation
   (`pending → partial → paid`), two endpoints (one for child, one for
   parent), database trigger on the children table — were considered
   and rejected (R2). Long-term impact: the `PaymentStatusPatch` schema
   has no `status` field; the only writable status is per-child, and
   the parent rolls up automatically. Frontend must learn the parent
   value from the read endpoint after every PATCH.

   📋 Architectural decision detected: derived parent status.
   Document reasoning and tradeoffs? Run
   `/sp.adr payments-derived-status`.

3. **Banker's rounding with largest-child residual absorption (vs
   per-row truncation, half-up rounding, or "drop the cent").**
   Alternative — per-row half-up + accept ±cents drift — was rejected
   because SC-001 requires `sum(child.amount) == developer_amount`
   exactly, and `Decimal × share / 70` is rarely exact at 2 dp.
   Banker's rounding is the IEEE 754 / financial-industry default for
   reducing systematic bias. The largest child absorbs the residual so
   no developer is short-changed at the expense of another;
   deterministic ordering (largest-share first, ties broken by
   `developer_id` ascending) is documented in `data-model.md`.

   📋 Architectural decision detected: banker's rounding + residual
   absorption. Document reasoning and tradeoffs? Run
   `/sp.adr payments-rounding-strategy`.

4. **Append-only ledger via schema omission (no PaymentUpdate type,
   no update repository helper, no PATCH /payments/{id} route).**
   Alternative — runtime check in service.update_payment that throws
   on any field other than status — was rejected because "absent
   capability" is a stronger guarantee than "runtime guard". A
   runtime check is one bug away from being bypassed; an absent type
   cannot be bypassed without writing new code. Long-term impact:
   corrections require generating a corrective Payment (FR-019);
   audit trail is never rewritten.

   📋 Architectural decision detected: append-only by omission.
   Document reasoning and tradeoffs? Run
   `/sp.adr payments-append-only-ledger`.

These are **suggestions only** — no ADR is auto-created. The user may
consent to any, all, or none.

## Stop & Report

Phase 0 (research) and Phase 1 (design + contracts) are complete.

- **Branch**: `006-payments-distribution`.
- **Plan path**: `specs/006-payments-distribution/plan.md`
- **Generated artifacts**:
  - `specs/006-payments-distribution/research.md`
  - `specs/006-payments-distribution/data-model.md`
  - `specs/006-payments-distribution/contracts/openapi.yaml`
  - `specs/006-payments-distribution/contracts/access-control-matrix.md`
  - `specs/006-payments-distribution/quickstart.md`

**Next step**: run `/sp.tasks payments` to convert this plan into the
executable, dependency-ordered `tasks.md` for the `payments` feature.
