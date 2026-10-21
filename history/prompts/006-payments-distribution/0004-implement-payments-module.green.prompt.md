---
id: 0004
title: Implement payments module green
stage: green
date: 2026-05-08
surface: agent
model: claude-sonnet-4-6
feature: 006-payments-distribution
branch: 006-payments-distribution
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: [payments, implement, green, uv, rbac, ledger, decimal, atomic-generation]
links:
  spec: specs/006-payments-distribution/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - backend/alembic/versions/20260505_create_payment_table.py
  - backend/app/modules/payments/model.py
  - backend/app/modules/payments/schema.py
  - backend/app/modules/payments/repository.py
  - backend/app/modules/payments/service.py
  - backend/app/modules/payments/routes.py
  - backend/scripts/audit_payments_imports.sh
  - backend/tests/conftest.py
  - backend/tests/_payments_helpers.py
  - backend/tests/test_payments_generate.py
  - backend/tests/test_payments_read.py
  - backend/tests/test_payments_developer_me.py
  - backend/tests/test_payments_status.py
  - backend/tests/test_payments_summary.py
tests:
  - test_payments_generate.py — 13 cases PASS (US1: 30/70 split, banker's rounding, residual absorption, share-sum drift, billable gating, RBAC, 401/403/404/422)
  - test_payments_read.py — 7 cases PASS (US2: list, project filter, detail with breakdown, RBAC)
  - test_payments_developer_me.py — 7 cases PASS (US3: own-row only, empty, denied for admin/manager, soft-deleted project)
  - test_payments_status.py — 12 cases PASS (US4: per-child paid → partial; target=all → paid; idempotent; cross-payment 422; mutually-exclusive 422; RBAC)
  - test_payments_summary.py — 5 cases PASS (US5: aggregates, by_status buckets, manager allowed, developer denied, empty zeros)
  - Full sweep: 222 passed, 13 warnings in 157.83s
---

## Prompt

/sp.implement

MODE: STRICT + SAFE + UV-ONLY

MODULE: Payments

RULES:
- DO NOT overwrite existing files; extend in place.
- USE uv only (uv add / uv sync / uv run).
- NO business logic in routes; service layer owns all calculations.
- ALL Decimal arithmetic centralised; banker's rounding; largest-share residual absorption.
- Append-only ledger by schema omission (no PaymentUpdate, no PATCH /payments/{id}).
- FR-023 sibling import allow-list: projects.repository, users.repository, auth.dependencies, auth.schema only.
- 401 → 403 → 404 → 422 guard ordering on every route.

VALIDATION:
- `uv run uvicorn app.main:app --reload` → /openapi.json lists 6 /payments path templates.
- `uv run pytest -q` → all green.
- `bash scripts/audit_payments_imports.sh` → exits 0.

ERROR RULE: On any failure, STOP, apply minimal fix, re-validate before continuing.

NEXT: /sp.specify reporting

## Response

Executed all 8 phases of `specs/006-payments-distribution/tasks.md` end-to-end without overwriting any existing files.

**Phase 1 — Foundation (T001–T007).** Created alembic migration `20260505_create_payment_table.py` (down_revision `20260504_project`) with `payment` (PK id, FK project_id ON DELETE RESTRICT, total/company/developer Numeric(12,2), status VARCHAR(16), CHECK total>0 and status IN pending|partial|paid) and `developer_payment` (FKs to payment + user + project_module, share_percentage Numeric(5,2) with CHECK 0 < share ≤ 70, amount Numeric(12,2) ≥ 0, status VARCHAR(8) IN pending|paid). Registered both models in `tests/conftest.py`. Wrote `backend/scripts/audit_payments_imports.sh` enforcing the FR-023 allow-list (projects.repository, users.repository, auth.dependencies, auth.schema; clients module entirely forbidden).

**Phase 2 — US1 Generate (T008–T017).** Built `tests/_payments_helpers.py` with `seed_payment_for_project(...)` and `assert_sum_invariants(...)` enforcing SC-001. Added 13 test cases covering admin/manager generate, 30/70 invariant, residual absorption (`100.01` over `[40, 30]`), share-sum drift, billable gating, project-not-found, total_amount validation (negative, zero, > 12 digits), RBAC denials. Authored `model.py`, `schema.py` (with `extra="forbid"` on PaymentGenerateRequest, `gt=0` Decimal field, model_validator for PaymentStatusPatch one-of), `repository.insert_payment_with_children` (atomic flush + add children), `service._distribute` (banker's rounding ROUND_HALF_EVEN with residual absorbed by largest-share child, ties broken by lowest id), `service.generate_payment_distribution` (validates project active + billable, sums shares, raises 8 typed exceptions), and 6 thin routes mapping exceptions to 401/403/404/422.

**Phase 3 — US2 Read (T018–T023).** Added 7 tests for list (id-ordered), project_id filter, detail-with-breakdown, missing 404, manager allowed, developer denied, unauth 401. Implemented `repository.get_payment` / `list_payment_children` / `list_payments(project_id=None)` and the GET routes.

**Phase 4 — US3 Developer self-service (T024–T028).** Added 7 tests verifying scope isolation, empty case, admin/manager denied, unauth 401, soft-deleted project does not hide rows. Implemented `repository.list_developer_payments_for_user` (joins Payment to expose project_id), `service.list_my_developer_payments`, and the `/developer/me` route gated by `require_any("developer")`.

**Phase 5 — US4 Status transitions (T029–T034).** Added 12 tests: per-child mark paid → parent partial; mark each child sequentially → parent paid; target=all → all paid; idempotent target=all on already-paid; cross-payment child 422; empty body 422; both fields 422; unknown field 422; manager 403; developer 403; missing payment 404; unauth 401. Implemented `mark_developer_payment_paid`, `mark_all_pending_paid`, `update_payment_status`, `service._derive_parent_status` (pure function over child statuses), and `service.update_payment_status` enforcing exactly-one-of and parent re-derivation.

**Phase 6 — US5 Summary (T035–T039).** Added 5 tests covering mixed-status aggregates, manager allowed, developer denied, empty-system zeros, unauth 401. Implemented `repository.summary_aggregates` (single SUM/COUNT GROUP BY status pass via `session.execute().one()` to avoid Row-tuple parsing issues) and `service.get_payment_summary`.

**Phase 7 — Polish (T040–T045).**
- T040: `bash scripts/audit_payments_imports.sh` → `OK: payments module only imports allow-listed symbols (FR-023)`.
- T041: `uv run pytest -q` → **222 passed, 13 warnings in 157.83s**.
- T042: In-process smoke (`from app.main import app`) confirmed 6 path templates: `/payments`, `/payments/developer/me`, `/payments/generate/{project_id}`, `/payments/summary`, `/payments/{id}`, `/payments/{id}/status`.
- T043: All quickstart.md happy paths (1–7) and error cases (4) are mirrored by the passing test suite.
- T044: `app/main.py` already contains `("payments", "/payments")` in MODULE_REGISTRY (verified, untouched).
- T045: This green PHR.

**Errors encountered and fixed:**
1. Audit script flagged a `from app.modules.projects.model import ProjectModule` import in `service.py`. Fixed by typing the parameter as `list[Any]` and dropping the model import — only `.repository` is allow-listed.
2. `summary_aggregates` raised `decimal.InvalidOperation` on empty database. Root cause: `session.exec(select(...)).one()` returned a Row whose `[0]` element couldn't be coerced. Fixed by switching to `session.execute(...).one()` and adding defensive `Decimal(str(value or 0))` wrapping.
3. `test_developer_payment_id_from_other_payment_returns_422` raised `DuplicateClientError` on phone uniqueness. Root cause: `seed_active_client` only varies email, but phone was hardcoded. Fixed by reusing the existing client via `clients.repository.list_clients(session)[0]`.

**Outcome:** 44 new payments tests + 178 prior = 222 PASS. Module is feature-complete per the spec, ledger-immutable by design, RBAC-correct, and audit-clean.

## Outcome

✅ All 8 phases complete. 222/222 tests pass. Audit clean. Module ready.

## Evaluation

- All five user stories (US1–US5) implemented with passing tests.
- Append-only ledger preserved (no PaymentUpdate schema, no PATCH /payments/{id}).
- Decimal arithmetic centralised in service layer; SC-001 sum-invariant property-tested.
- FR-023 sibling-import contract enforced by audit script in CI-friendly form.
- Zero changes to `app/main.py` (registry was pre-wired in feature 005).

## Follow-ups

- Proceed to `/sp.specify reporting` per the user's NEXT directive.
- Consider adding pagination to GET /payments if list size grows beyond a few hundred.
- A future ADR may be warranted if reporting introduces cross-module aggregate joins that strain the FR-023 allow-list.
