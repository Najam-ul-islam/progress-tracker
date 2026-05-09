---
id: 0002
title: Payments implementation plan
stage: plan
date: 2026-05-07
surface: agent
model: claude-sonnet-4-6
feature: 006-payments-distribution
branch: 006-payments-distribution
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: [payments, plan, modular, decimal, atomic-transaction, derived-status]
links:
  spec: specs/006-payments-distribution/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/006-payments-distribution/plan.md
  - specs/006-payments-distribution/research.md
  - specs/006-payments-distribution/data-model.md
  - specs/006-payments-distribution/contracts/openapi.yaml
  - specs/006-payments-distribution/contracts/access-control-matrix.md
  - specs/006-payments-distribution/quickstart.md
  - history/prompts/006-payments-distribution/0002-payments-implementation-plan.plan.prompt.md
tests:
  - n/a (plan stage; tests will follow in /sp.tasks → /sp.implement, ≥35 cases per SC-006)
---

## Prompt

/sp.plan

MODULE: Payments

OBJECTIVE:
Implement payment distribution and earnings tracking using modular uv-based architecture.

---

PHASES:

1. Validate dependencies
2. Create models:
   - Payment
   - DeveloperPayment
3. Create schemas
4. Repository layer
5. Service layer:
   - 30/70 calculation
   - earnings distribution
   - RBAC
6. Routes
7. Register routes in main.py
8. Validation/testing

---

RULES:
- No business logic in routes
- Centralize calculations in service layer
- Use auth RBAC

---

NEXT:
/sp.tasks payments

## Response snapshot

Ran `setup-plan.ps1 -Json` to obtain branch + paths
(`specs/006-payments-distribution/plan.md` populated from template).

Authored the full plan + Phase 0 / Phase 1 artefacts following the
established style (continuity with feature 005's plan):

- **plan.md** — Summary, Technical Context (Python 3.13, no new deps),
  Constitution Check (default policies — same template as 005),
  Project Structure (file tree showing six-file `payments/` module,
  `20260505_create_payment_table.py` alembic, `audit_payments_imports.sh`,
  five new test files mapping 1:1 to US1–US5), Phase 0 → Phase 1
  outputs table, Re-evaluated Constitution Check, Complexity Tracking
  (none), Architectural Decision suggestions (4 ADR-significant decisions
  surfaced).
- **research.md** — 10 R-numbered decisions: R1 atomic generation, R2
  derived parent status, R3 banker's rounding + residual absorption,
  R4 frozen referential snapshot, R5 SQLite-in-mem test DB, R6 audit
  script for FR-023, R7 concurrency (no locking), R8 RBAC layered
  guards, R9 logging, R10 Decimal-as-string. Each records decision,
  rationale, and rejected alternatives.
- **data-model.md** — full table specs for `payment` (7 cols) and
  `developer_payment` (8 cols) with FK ON DELETE RESTRICT, CHECK
  constraints, indexes, mutability rules, distribution algorithm pseudo-
  code, status derivation function, alembic upgrade/downgrade plan.
- **contracts/openapi.yaml** — 7 endpoints (POST /payments/generate/{id},
  GET /payments, GET /payments/{id}, GET /payments/developer/me, PATCH
  /payments/{id}/status, GET /payments/summary), 8 schemas (closed
  request bodies + read shapes + summary buckets), Decimal-as-string on
  the wire.
- **contracts/access-control-matrix.md** — role × endpoint matrix,
  guard ordering (401 → 403 → 404 → 422), 8 typed exceptions → HTTP
  mapping, rationale for the developer-scoped endpoint being separate
  rather than role-branched.
- **quickstart.md** — curl walk-through for all 7 endpoints + 5 common
  error responses + sum-invariant verification snippet.

Skipped Phase 1 agent context update — no new tech (Decimal, atomic
transaction, banker's rounding are stdlib + SQLModel default).

Constitution Check passed both before Phase 0 and after Phase 1: zero
violations, zero entries in Complexity Tracking. Default policies from
CLAUDE.md are honoured (smallest viable diff, no invented APIs, no
secrets, six-file layout, ADR-0003 spirit, FR-027/FR-023 boundary).

Four architectural decisions surfaced as ADR-worthy:
1. atomic generation in one transaction
2. derived parent status (no operator-settable status field)
3. banker's rounding + largest-child residual absorption
4. append-only ledger by schema omission

Per the constitution, no ADR was auto-created — the user may consent
to any, all, or none via `/sp.adr`.

## Outcome

- ✅ Impact: Phase 0 + Phase 1 artefacts complete; module is ready for `/sp.tasks payments`.
- 🧪 Tests: deferred to `/sp.tasks` and `/sp.implement` (≥35 cases per SC-006: US1≥10, US2≥6, US3≥6, US4≥8, US5≥3 + edges).
- 📁 Files: 6 — plan.md, research.md, data-model.md, contracts/openapi.yaml, contracts/access-control-matrix.md, quickstart.md (+ this PHR = 7).
- 🔁 Next prompts: `/sp.tasks payments` → `/sp.implement`.
- 🧠 Reflection: Reusing feature 005's plan as a template paid off — Constitution Check, Complexity Tracking, and ADR-suggestions sections transferred directly. The biggest delta is the **append-only-by-omission** discipline (no PaymentUpdate schema, no PATCH /payments/{id} route, only the status PATCH which writes through to children + re-derives parent). That single design choice eliminated an entire category of audit-trail bugs at the schema layer.

## Evaluation notes (flywheel)

- Failure modes observed: prior /sp.plan invocation pasted stale Projects-module template args; resolved with one clarifier and a re-invocation. The `setup-plan.ps1 -Json` script ran cleanly and produced the right branch/paths.
- Graders run and results (PASS/FAIL): Constitution Check PASS (0 violations, 0 complexity entries); spec-quality checklist PASS (carried over from /sp.specify, all 12 items ticked).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): the "append-only by omission" pattern is reusable for any future audit-trail entity (e.g., a future `audit_event` module). Worth promoting to a constitution principle if a third feature wants the same shape.
