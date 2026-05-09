---
id: 0003
title: Payments tasks breakdown
stage: tasks
date: 2026-05-07
surface: agent
model: claude-sonnet-4-6
feature: 006-payments-distribution
branch: 006-payments-distribution
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: [payments, tasks, dependency-order, mvp, rbac, atomic-generation]
links:
  spec: specs/006-payments-distribution/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/006-payments-distribution/tasks.md
  - history/prompts/006-payments-distribution/0003-payments-tasks.tasks.prompt.md
tests:
  - n/a (tasks stage; suite landed in /sp.implement). Target ≥35 cases per SC-006.
---

## Prompt

/sp.tasks

MODULE: Payments

---

GLOBAL RULES:
- Use uv only
- No overwrite
- No logic in routes

---

TASKS:

1. Dependencies
- validate/install via uv

2. Models (payments/model.py)
- Payment
- DeveloperPayment

3. Schemas (payments/schema.py)
- PaymentCreate
- PaymentRead
- DeveloperPaymentRead
- PaymentStatusUpdate

4. Repository (payments/repository.py)
- create/get/update payments
- create/get developer payments

5. Service (payments/service.py)

Implement:
- generate_payment_distribution
- calculate_company_share
- calculate_developer_shares
- get_payment_summary
- update_payment_status

RULES:
- company = 30%
- developers = 70%
- validate shares

RBAC:
- admin → full
- manager → manage/view
- developer → own earnings only

6. Routes (payments/routes.py)

Endpoints:
- POST /payments/generate/{project_id}
- GET /payments
- GET /payments/{id}
- GET /payments/developer/me
- PATCH /payments/{id}/status

7. Integration
- register router in main.py

8. Validation
- run app
- test calculations/endpoints

---

SUCCESS:
- correct calculations
- earnings generated
- RBAC enforced

## Response snapshot

Ran `check-prerequisites.ps1 -Json` — all four design docs present
(`research.md`, `data-model.md`, `contracts/`, `quickstart.md`).

Generated `specs/006-payments-distribution/tasks.md` with **45 tasks
across 8 phases**, organised by user story per the template's primary
rule. Phases:

- **Phase 1 — Setup** (T001–T003): toolchain + dependency + stubs check
- **Phase 2 — Foundational** (T004–T007): alembic revision
  `20260505_create_payment_table.py`, `alembic upgrade head`, conftest
  one-line edit, FR-023 audit script
- **Phase 3 — US1 Generate** (T008–T018): MVP boundary; ≥10 tests, model,
  schema, repository, typed exceptions, `_distribute` rounding helper,
  `generate_payment_distribution`, route, audit, sweep
- **Phase 4 — US2 Read** (T019–T023): ≥6 tests, list/detail repository,
  service helpers, two routes
- **Phase 5 — US3 Developer self-service** (T024–T028): ≥6 tests,
  developer-scoped repository helper, service shape, route
- **Phase 6 — US4 Mark paid** (T029–T034): ≥8 tests,
  `PaymentStatusPatch` closed schema, monotonic mark-paid helpers,
  derived parent status, route
- **Phase 7 — US5 Summary** (T035–T039): ≥3 tests, single SUM/COUNT
  query, summary schemas, route
- **Phase 8 — Polish** (T040–T045): final audit + full pytest sweep
  (≥213 expected) + uvicorn smoke + quickstart walk-through + green PHR

**Aligned mapping** to the user's task list (renamed 5→7 service
helpers per the spec's clearer names, but every named function is
covered):

- "generate_payment_distribution" → T015
- "calculate_company_share" / "calculate_developer_shares" → folded
  into T015 (computed inline using Decimal arithmetic) + T014 (the
  `_distribute` private helper handles per-child slicing)
- "get_payment_summary" → T037
- "update_payment_status" → T032

**MVP boundary**: Phases 1+2+3+4+5 (US1+US2+US3 — all P1) deliver a
read-only payments ledger. US4 (P2) closes the lifecycle; US5 (P3) adds
the dashboard. The plan's "append-only ledger by omission" pattern
manifests in tasks.md as: no `PaymentUpdate` schema task, no
`update_payment` repository task, no PATCH /payments/{id} route task.

**Parallel opportunities** explicitly enumerated:
- T001–T003 (setup checks)
- T008+T019+T024+T029+T035 (test scaffolds across stories — different files)
- T010+T011 (model vs schema in US1)
- US2 + US3 implementation tracks (different developers, different
  test files)
- T040+T041+T043 (Phase 8 audit + sweep + quickstart)

**Suggested MVP scope** declared up front: User Story 1 alone is
deployable as a generate-only ledger; adding US2+US3 yields the
full read-only payments view.

## Outcome

- ✅ Impact: 45 dependency-ordered tasks ready for `/sp.implement`. Every task carries checkbox + ID + (optional [P]) + (optional [Story]) + file path per the template's required format.
- 🧪 Tests: deferred to `/sp.implement`; ≥35 cases planned across 5 test files (US1≥10, US2≥6, US3≥6, US4≥8, US5≥3) per SC-006.
- 📁 Files: 2 — tasks.md and this PHR.
- 🔁 Next prompts: `/sp.implement` (executes tasks T001–T045 in order, with parallel opportunities).
- 🧠 Reflection: The user's task list referenced "PaymentCreate" and "PaymentStatusUpdate" schemas; renamed to `PaymentGenerateRequest` and `PaymentStatusPatch` to honour the spec's append-only-by-omission discipline (there is no PaymentCreate / PaymentUpdate — those imply CRUD shape, but Payments are an audit ledger). Documented the rename in tasks.md notes so the implementer doesn't get tripped up.

## Evaluation notes (flywheel)

- Failure modes observed: none — `check-prerequisites.ps1` ran cleanly; template was directly usable.
- Graders run and results (PASS/FAIL): self-review of every task line PASS (all 45 follow the strict `- [ ] Tnnn [P?] [Story?] description path` format).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): the rename "PaymentCreate → PaymentGenerateRequest" is a recurring pattern (audit-ledger vs CRUD distinction). Consider promoting "ledger entities use Generate/Patch verbs, not Create/Update" to a constitution principle.
