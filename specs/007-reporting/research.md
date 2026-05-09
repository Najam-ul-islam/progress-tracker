# Phase 0 Research: Reporting & Analytics

**Feature**: `007-reporting`
**Date**: 2026-05-08

This file captures the design decisions made before code lands, including the alternatives considered and why they were rejected. Every decision below is referenced from `plan.md`.

---

## Decision 1 — Aggregation strategy: SQL-side `GROUP BY` vs. Python loops

**Decision**: Push every aggregation to SQL (`func.count`, `func.sum`, `func.avg`, `case`, `group_by`). Hydrate ORM rows only when both an aggregate AND a per-row attribute are needed in the same payload (e.g., the project report's per-project rows with module list).

**Rationale**:

- SC-005 caps each endpoint at ≤4 round-trips. Python-loop aggregation forces N+1 (one query per project for module progress) which violates the cap on any non-trivial dataset.
- Postgres + SQLite both support every primitive used (`COUNT`, `SUM`, `AVG`, `CASE WHEN ... THEN ... END`, `COALESCE`, `GROUP BY`). The same query string runs in tests and production.
- Decimal arithmetic stays in the database where it is rounding-stable; no float coercion ever happens en route.
- Smaller wire payload between DB and app server: aggregates are O(groups), not O(rows).

**Alternatives considered**:

- *Hydrate every row and aggregate in Python.* Rejected — explodes round-trip count and memory on any growth; cannot be reconciled with SC-005 or SC-001.
- *Materialised views or scheduled rollups.* Rejected — the spec's edge case "Stale aggregates" explicitly forbids caching in v1; correctness is preferred over latency until the dataset proves it needs precomputation.

---

## Decision 2 — Delegate to `payments.repository.summary_aggregates` from the dashboard

**Decision**: The `/reports/dashboard` endpoint's "payments" block calls the existing `payments.repository.summary_aggregates(session)` and re-shapes the dict for the dashboard payload. The financial report (`/reports/payments`) does **not** delegate — it issues its own per-project grouped query because `summary_aggregates` returns global sums only.

**Rationale**:

- FR-023 already allow-lists `payments.repository` (read-only). Delegation removes ~30 lines of duplicate aggregation SQL.
- `summary_aggregates` is already covered by feature 006's tests; reusing it inherits that coverage.
- The dashboard does not need per-project rows, so the existing function's shape fits exactly. The financial report needs per-project rows with `outstanding`, which `summary_aggregates` does not produce — delegating there would mean an extra round-trip plus a second query, defeating the point.

**Alternatives considered**:

- *Re-implement summary SQL inside reporting.* Rejected — duplicates code already audited and tested in feature 006.
- *Have the financial report also delegate, and post-process in Python.* Rejected — would require fetching every payment and looping, blowing the round-trip cap.

---

## Decision 3 — Filter validation lives in the service, not in routes or schemas

**Decision**: Routes accept query params as `str | None` and pass them to a single `service._normalise_filters(...)` helper. The helper returns a typed `FilterContext` dataclass or raises one of `InvalidDateRange / InvalidProjectStatus / ClientNotFound / DeveloperNotFound`. Routes catch these exceptions and map to HTTP 422.

**Rationale**:

- "Routes = zero business logic" (constitution + user input). Filter parsing IS business logic — it interprets user intent and may consult the database (FK existence checks under FR-019).
- Centralising filter parsing in one helper means every endpoint validates the same way. No drift between dashboard, projects, developers, payments reports.
- Pydantic schema-side validation cannot do FK existence checks (those need the session). Doing partial validation in Pydantic + partial in service splits the rule across two surfaces, hiding it.

**Alternatives considered**:

- *Pydantic `Query` models with custom validators.* Rejected for the FK-existence cases (need session). Used as a complement: Pydantic still validates string format (date parsing, status enum membership), service does FK checks.
- *Dedicated `dependencies.py` factory per filter.* Rejected — would require route-level wiring of multiple `Depends(...)` per endpoint, increasing route LOC and burying the rule.

---

## Decision 4 — RBAC scoping for `/reports/developers/me`

**Decision**: The route gates with `Depends(require_any("developer"))`. Inside the service, the `developer_id` parameter is **always** taken from `current_user.id`. Any client-supplied `developer_id` query param on this endpoint is silently ignored (not 422) — the surface-area axiom is "the URL spelled `/me` cannot describe anyone but the caller."

**Rationale**:

- FR-016 mandates server-side scoping. The choice between "ignore" vs. "422 on mismatch" is a UX call: ignoring is the less-surprising option for a `/me` endpoint that has historically forbidden the param entirely.
- Matches the developer self-service pattern from feature 006 (`/payments/developer/me`), which has no `developer_id` param at all. Reporting follows suit by not declaring one in the OpenAPI contract.

**Alternatives considered**:

- *Accept `developer_id` and 422 on mismatch.* Rejected — the param has no legitimate use on a `/me` endpoint; declaring it invites confusion.
- *Reuse the global `/reports/developers` endpoint with self-detection logic.* Rejected — that endpoint is admin/manager-only by RBAC, and merging the two collapses two distinct authorisation contexts onto one path.

---

## Decision 5 — `pending_amount` semantics

**Decision**: Dashboard `payments.pending_amount = sum(payment.total_amount where payment.status != 'paid')`. This is the sum of *parent* payment totals where the parent has not yet reached the `paid` derived state — i.e., either fully `pending` or `partial`.

**Rationale**:

- Matches what an admin reading the dashboard expects: "how much money is still owed to developers right now?" — which corresponds to the parent-status view, not to per-child rollup.
- Avoids a second query against `developer_payment` purely to surface the same number from the children's side. The parent's `total_amount` already reflects the not-yet-paid envelope.

**Alternatives considered**:

- *Sum `developer_payment.amount where status = 'pending'` only.* Rejected — that excludes the company's 30% reserve, which is also "pending payout" in the operational sense and is the number admins ask for.
- *Include the company reserve as a separate sub-total.* Considered. Deferred to v2 if dashboards demand it; for now, `pending_amount` is the parent-status sum and the schema documents the definition clearly.

---

## Decision 6 — "Today" for the overdue calculation

**Decision**: `today = func.current_date()` at the database, **not** `datetime.now().date()` in Python. This pushes the comparison into the WHERE clause and avoids a round-trip + Python-side filter.

**Rationale**:

- Consistency: the same SQL runs in any timezone the database is configured for. Time-zone correctness is the database's responsibility, not Python's.
- Determinism in tests: SQLite's `CURRENT_DATE` is the host's local date — same as `date.today()` — so tests behave predictably.
- One fewer Python-side branch.

**Alternatives considered**:

- *`date.today()` in Python.* Rejected — splits the date semantics across two layers. Edge case: a midnight rollover between query construction and execution (rare but possible) would produce inconsistent results.

---

## Decision 7 — Audit script forbids both imports AND mutation

**Decision**: `backend/scripts/audit_reporting_imports.sh` enforces two rules:
  1. Imports from sibling `app.modules.*` modules are restricted to the FR-023 allow-list (`projects.repository`, `payments.repository`, `users.repository`, `clients.repository`, `auth.dependencies`, `auth.schema`).
  2. The strings `session.add(`, `session.delete(`, `session.merge(`, and `session.commit(` MUST NOT appear anywhere under `backend/app/modules/reporting/`.

**Rationale**:

- Rule 1 carries forward the FR-023 contract. It catches the most common architectural drift (importing a sibling's `service` for convenience).
- Rule 2 codifies the read-only ledger contract that distinguishes reporting from every other feature. A grep is a stronger guard than test coverage because it catches mutation paths even if a test never triggers them.
- Both rules run in CI in <1 s; cost is negligible.

**Alternatives considered**:

- *Static analysis via mypy plugin.* Rejected — overkill for a project-local rule; grep is enough and is trivial to audit.
- *Mark `Session` as `Read[Session]` typed alias.* Rejected — false security; a typed alias does not constrain runtime calls.

---

## Decision 8 — Test landscape fixture: one helper, used by all five test files

**Decision**: A single `tests/_reporting_helpers.py` exposes `seed_reporting_landscape(client, session, seed_admin, seed_developer, auth_header)` that builds a deterministic graph: 2 clients, 4 projects (one of each status: pending, active, completed, active-but-overdue), 6 modules across 3 developers, 4 payments (mixed statuses). Returns a typed dict containing every id the tests need to make assertions.

**Rationale**:

- Reduces per-file fixture duplication from ~50 lines × 5 files to one ~80-line helper + small per-file overrides.
- Determinism: every test asserts against the same numeric expectations (counts, sums) without re-deriving them.
- Tests stay focused on what they verify (the report shape) instead of on the seeding ritual.

**Alternatives considered**:

- *Per-test ad-hoc fixtures.* Rejected — high churn, drift between tests on identical numbers.
- *Pytest `conftest` fixture.* Considered, but kept as a plain helper for explicitness — the call site documents which graph the test asserts against.
