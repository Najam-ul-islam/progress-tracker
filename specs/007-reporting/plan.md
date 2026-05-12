# Implementation Plan: Reporting & Analytics

**Branch**: `007-reporting` | **Date**: 2026-05-08 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/007-reporting/spec.md`

## Summary

Stand up the `reporting` module: a six-file modular slice that owns **zero new SQLModels and zero migrations**, and exposes five HTTP endpoints under `/reports` with the RBAC matrix `admin = full`, `manager = dashboard + projects + developers + payments report`, `developer = /reports/developers/me only`. Every metric is computed live from the existing tables (`project`, `project_module`, `payment`, `developer_payment`, `user`, `client`) via grouped-aggregation queries — never N+1, never row-by-row in Python. Routes contain zero business logic; the service layer owns all aggregation, filtering, RBAC scoping, and frontend-shaped projection. A new CI audit script (`audit_reporting_imports.sh`) fails the build if `reporting/**.py` imports business logic from any sibling beyond the FR-023 allow-list (`projects.repository`, `payments.repository`, `users.repository`, `clients.repository`, `auth.dependencies`, `auth.schema`).

**Technical approach** (validated in [`research.md`](./research.md)):

- Six-file modular layout under `backend/app/modules/reporting/`. The feature **fills** four (`schema / repository / service / routes`) and leaves `model.py` and `dependencies.py` empty (the module owns no entities and uses `auth.dependencies` directly).
- All aggregations are SQL-side: `func.count`, `func.sum`, `func.avg`, `case`, and `group_by` against existing tables. Each endpoint issues at most 4 round-trips (SC-005), typically 2–3.
- The `reporting.repository` module exposes purpose-built aggregation functions (`dashboard_project_counts`, `dashboard_developer_metrics`, `dashboard_payment_aggregates`, `project_report_rows`, `developer_report_rows`, `financial_report_rows`, `developer_self_breakdown`). Each returns a list of typed dataclasses or dicts shaped exactly for the service layer's projection — no SQLModel hydration when only sums are needed.
- For sums that already exist in `payments.repository` (e.g., `summary_aggregates`), the dashboard endpoint **delegates** to that function rather than re-implementing the SQL — it is allow-listed for read-only use under FR-023.
- Reuse `auth.dependencies.{get_current_user, require_admin, require_any}` for role gates; self-service scoping (`/reports/developers/me`) injects `current_user.id` server-side and ignores any client-supplied `developer_id` query param.
- Filter validation is centralised in a single `_normalise_filters` service helper that returns either a typed `FilterContext` dataclass or raises one of the typed exceptions (`InvalidDateRange`, `InvalidProjectStatus`, `ClientNotFound`, `DeveloperNotFound`).
- Cross-module FK validation (`client_id` exists, `developer_id` exists) is delegated to `clients.repository.get_client_by_id` and `users.repository.get_user_by_id` — both read-only, both allow-listed.
- Test surface: SQLite-in-memory `TestClient` with the existing `dependency_overrides[get_session]`, reusing fixtures from prior features (`seed_admin / seed_manager / seed_developer / auth_header / seed_active_client / seed_active_project / seed_module / seed_payment_for_project`). One new helper `seed_reporting_landscape` builds the multi-project/multi-developer/multi-payment fixture used by every test file.

## Technical Context

**Language/Version**: Python 3.13.

**Primary Dependencies** (already installed — **no additions**):

- `fastapi`, `sqlmodel`, `pydantic` v2, `pydantic-settings`.
- `sqlalchemy` (transitive) — for `func.count / func.sum / func.avg / func.coalesce / case / group_by`.
- **No new dependencies** introduced by this feature. `uv add` is not invoked at any phase.

**Decimal arithmetic**: standard library `decimal`. Reporting performs **summation only** — it never multiplies, never rounds, never redistributes. All redistribution math already happened in feature 006 (payments). Sums are read with `func.coalesce(func.sum(...), 0)` and surfaced as decimal-strings on the wire (Pydantic v2 default).

**Test deps** (already present): `pytest`, `pytest-asyncio`, `httpx`.

**Storage**: PostgreSQL for dev/prod; SQLite in-memory + `StaticPool` for tests. Both engines support every aggregate function used (`COUNT`, `SUM`, `AVG`, `CASE WHEN ... THEN ... END`, `COALESCE`, `GROUP BY`). No new tables, no new indexes — the feature relies on indexes already established by features 003–006 (`project.is_active`, `project.client_id`, `project_module.project_id`, `project_module.assigned_developer_id`, `project_module.is_active`, `payment.project_id`, `developer_payment.payment_id`, `developer_payment.developer_id`).

**Testing**: `pytest` + FastAPI `TestClient`. Five new test files mapping 1:1 to user stories:

- `test_reporting_dashboard.py` (US1 — ≥6 cases, FR-001, FR-009..FR-012, RBAC)
- `test_reporting_projects.py` (US2 — ≥6 cases, FR-002, FR-013, FR-017..FR-021)
- `test_reporting_developers.py` (US3 — ≥5 cases, FR-003, FR-014, RBAC)
- `test_reporting_financial.py` (US4 — ≥4 cases, FR-004, FR-015, RBAC)
- `test_reporting_developer_me.py` (US5 — ≥4 cases, FR-005, FR-016, scope-isolation)

Plus a small `test_reporting_audit.py` that programmatically asserts `reporting.repository.*` is the only business-logic source the routes touch (mirrors the audit script in test form).

**Target Platform**: Linux server (containerised) for prod; Windows 10 + native Python for dev.

**Project Type**: web-application backend (`backend/`). This feature only touches `backend/`.

**Performance Goals**: 95th percentile of every `GET /reports/*` endpoint under 1 second on a database with ≤1,000 projects, ≤100 developers, ≤10,000 payments (SC-001). Hot paths are entirely SQL-side aggregations.

**Constraints**:

- **uv-only** for dependency and runtime usage. (Memory entry: "Project: progress-tracker uses uv only".)
- **Non-destructive integration**: existing modules (`auth`, `users`, `clients`, `projects`, `payments`) MUST keep importing cleanly. Files outside `reporting/` touched by this feature: one new audit script, one one-line addition to `app/main.py`'s `MODULE_REGISTRY` (`("reporting", "/reports")`). **No alembic revision.** **No conftest changes** (the existing `Base.metadata.create_all` already covers every table the queries touch).
- **No business logic in routes**; routes call services only and map typed exceptions to HTTP statuses.
- **Six-file layout per module** is mandatory; two of the six (`model.py`, `dependencies.py`) are intentionally empty stubs.
- **Module boundaries** (FR-023): `reporting` may import only `projects.repository`, `payments.repository`, `users.repository`, `clients.repository`, `auth.dependencies`, and `auth.schema`. The audit script encodes the allow-list.
- **Read-only ledger contract**: reporting MUST NOT mutate any row in any table. Every database operation is `SELECT`. The audit script also forbids `session.add`, `session.delete`, `session.merge`, and `session.commit` inside `reporting/`.
- **N+1 ban**: each endpoint issues a small constant number of queries (≤4) regardless of dataset size. Verified by query-counting in tests.
- **401 → 403 → 404 → 422 ordering** preserved on every route.

**Scale/Scope**: 5 endpoints, 4 filled module files (~600 LOC), ~25 test cases, zero migrations, zero schema changes, zero new dependencies.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository's `.specify/memory/constitution.md` is currently a placeholder. The de-facto constitution carried forward from features 003–006 is captured here and verified:

| Principle (de-facto) | Compliance |
|---|---|
| Six-file modular layout per module | ✅ `model / schema / repository / service / routes / dependencies` (two empty stubs) |
| Zero business logic in routes | ✅ routes only validate, dispatch, and map exceptions |
| Centralised service layer for all logic + RBAC scoping | ✅ all aggregation in `reporting.service` |
| FR-023 sibling-import allow-list per feature | ✅ encoded in `audit_reporting_imports.sh` |
| 401 → 403 → 404 → 422 ordering | ✅ each route's try/except chain in that order |
| Read-only modules MUST NOT mutate state | ✅ audit script rejects `session.add/delete/merge/commit` |
| uv-only for deps and runtime | ✅ no `uv add` invocations; existing deps cover everything |
| Append-only ledger preservation (carried from 006) | ✅ feature is read-only by design — cannot violate |
| Test surface ≥ functional coverage | ✅ ≥25 test cases targeted (SC-008) |
| No 500 on valid authenticated requests | ✅ defensive `coalesce(..., 0)` + `or 0` on every sum |

**Result**: PASS. No violations. Complexity Tracking section omitted (no exceptions to justify).

## Project Structure

### Documentation (this feature)

```text
specs/007-reporting/
├── spec.md              # already authored by /sp.specify
├── plan.md              # this file
├── research.md          # Phase 0 — chosen aggregation strategies
├── data-model.md        # Phase 1 — read-only views over existing entities
├── quickstart.md        # Phase 1 — curl walk-through
├── contracts/
│   └── reporting.openapi.yaml   # 5 endpoints, request + response schemas
├── checklists/
│   └── requirements.md  # already authored by /sp.specify
└── tasks.md             # generated by /sp.tasks (not by /sp.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── main.py                            # +1 line: ("reporting", "/reports") in MODULE_REGISTRY
│   └── modules/
│       └── reporting/
│           ├── __init__.py
│           ├── model.py                   # empty stub (no own entities)
│           ├── schema.py                  # Pydantic v2 response models
│           ├── repository.py              # SQL-side aggregations (6–7 functions)
│           ├── service.py                 # filter normalisation, RBAC scoping, projection
│           ├── routes.py                  # 5 thin GET routes
│           └── dependencies.py            # empty stub (uses auth.dependencies)
├── scripts/
│   └── audit_reporting_imports.sh         # FR-023 enforcement
└── tests/
    ├── _reporting_helpers.py              # seed_reporting_landscape + assertion helpers
    ├── test_reporting_dashboard.py        # US1
    ├── test_reporting_projects.py         # US2
    ├── test_reporting_developers.py       # US3
    ├── test_reporting_financial.py        # US4
    ├── test_reporting_developer_me.py     # US5
    └── test_reporting_audit.py            # FR-023 + read-only invariant test
```

**Structure Decision**: Six-file modular layout under `backend/app/modules/reporting/`, identical to features 003–006. Two of the six files (`model.py`, `dependencies.py`) are intentional empty stubs because the feature owns no entities and uses `auth.dependencies` directly. The empty stubs are deliberate to preserve the layout invariant, not laziness.

## Phase 0: Outline & Research

See [`research.md`](./research.md). Resolved questions:

1. **Should "active assignments" count developers or modules?** → developers. (FR-010 phrasing.)
2. **Where does `date_range` filter on the dashboard?** → it does not. The dashboard is "now" by definition; date_range is only valid on the four drill-down endpoints (FR-002/FR-003/FR-004/FR-005).
3. **Do we delegate payment sums to `payments.repository.summary_aggregates`?** → yes for the dashboard's payments block; no for the financial report (which needs per-project breakdown that `summary_aggregates` does not provide).
4. **How is `pending_amount` defined in the dashboard?** → sum of `payment.total_amount` where `payment.status != 'paid'` (i.e., `pending` + `partial`). Documented in FR-012.
5. **Average module progress on an empty system?** → `0.0` not null (FR-011).
6. **Should soft-deleted projects appear in the financial report?** → yes when their payments still exist, because the ledger has to reconcile. Operational counts (dashboard) exclude them; financial reconciliation includes them. Documented in spec edge cases.

## Phase 1: Design & Contracts

See [`data-model.md`](./data-model.md) for the read-only DTO shapes (no new tables) and [`contracts/reporting.openapi.yaml`](./contracts/reporting.openapi.yaml) for the OpenAPI 3.1 contract. See [`quickstart.md`](./quickstart.md) for the end-to-end curl walk-through covering happy paths and the four required error responses.

Re-evaluation post-design: Constitution Check still PASS. No violations introduced by the contract or data model. Audit script forbids `session.add/delete/merge/commit`; FR-023 allow-list updated to include `clients.repository` (needed for `client_id` filter validation under FR-019).

## Complexity Tracking

> No violations to justify. The feature deliberately introduces:
>
> - **Zero** new tables.
> - **Zero** alembic revisions.
> - **Zero** new Python dependencies.
> - **Two intentionally empty** files (model.py, dependencies.py) — preserved purely to keep the six-file layout invariant.
>
> Complexity is bounded by re-using existing repositories where their shape fits and writing purpose-built grouped-aggregation queries where it does not. No clever caching, no precomputed materialised views, no background recomputation.
