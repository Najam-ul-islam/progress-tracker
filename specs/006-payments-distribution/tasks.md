---

description: "Executable, dependency-ordered task list for the Payments Distribution feature"
---

# Tasks: Payments Distribution

**Feature**: `006-payments-distribution`
**Date**: 2026-05-07
**Branch**: `006-payments-distribution`
**Input**: Design documents from `specs/006-payments-distribution/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `contracts/access-control-matrix.md`, `quickstart.md`

**Tests**: REQUIRED. SC-006 mandates ≥35 test cases (US1≥10, US2≥6, US3≥6, US4≥8, US5≥3, plus edges). Tests are written alongside (or before) implementation per user story; the suite must pass before merge.

**Organization**: Tasks are grouped by user story (US1–US5). Each story is independently completable + testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to a user story (US1, US2, US3, US4, US5)
- All paths are absolute from repo root

## Path Conventions

Web-application backend (`backend/`) — see `plan.md` § Project Structure.
All payments source under `backend/app/modules/payments/`; tests under
`backend/tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Validate environment and dependencies. The six-file module
stub directory already exists (`backend/app/modules/payments/`).

- [ ] T001 Validate Python 3.13 + uv toolchain by running `uv --version && uv run python --version` in `backend/`
- [ ] T002 [P] Confirm no new dependencies required: `grep -E "fastapi|sqlmodel|pydantic|alembic" backend/pyproject.toml` — feature 006 adds zero deps (Decimal is stdlib)
- [ ] T003 [P] Confirm payments stub files exist: `ls backend/app/modules/payments/{model,schema,repository,service,routes,dependencies}.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish DB schema + register tables with the test
fixture. Every user story depends on these.

**⚠️ CRITICAL**: No user story work can begin until Phase 2 completes.

- [ ] T004 Create alembic revision `backend/alembic/versions/20260505_create_payment_table.py` with `down_revision = "20260504_project"`. Define `payment` (id PK, project_id FK ON DELETE RESTRICT, total_amount Numeric(12,2) > 0, company_amount Numeric(12,2), developer_amount Numeric(12,2), status VARCHAR(16) default 'pending' CHECK in (pending, partial, paid), created_at) and `developer_payment` (id PK, payment_id FK ON DELETE RESTRICT, developer_id FK user.id ON DELETE RESTRICT, module_id FK project_module.id ON DELETE RESTRICT, share_percentage Numeric(5,2) CHECK > 0 AND ≤ 70, amount Numeric(12,2) CHECK ≥ 0, status VARCHAR(8) default 'pending' CHECK in (pending, paid), created_at). Add four indexes per `data-model.md`. `downgrade()` drops `developer_payment` first, then `payment`.
- [ ] T005 Run alembic dry-run: `cd backend && uv run alembic upgrade head` — must succeed without errors against the local Postgres dev DB
- [ ] T006 Edit `backend/tests/conftest.py` to add `from app.modules.payments.model import Payment, DeveloperPayment  # noqa: F401` so SQLModel `metadata.create_all` picks the tables up in tests
- [ ] T007 Create FR-023 audit script `backend/scripts/audit_payments_imports.sh` mirroring `audit_projects_imports.sh`, with allow-list `(projects.repository|users.repository|auth.dependencies|auth.schema)` and matching both `from app.modules.X.repository import …` and `from app.modules.X import repository` forms; exit non-zero on a hit. Make executable.

**Checkpoint**: DB schema migrated, test fixture wired, audit gate in place. User-story phases may now begin.

---

## Phase 3: User Story 1 — Generate Payment Distribution (Priority: P1) 🎯 MVP

**Goal**: Admin or manager calls `POST /payments/generate/{project_id}` and the system atomically creates one Payment + one DeveloperPayment per active module, with a correct 30/70 split and per-child distribution that sums exactly to `developer_amount`.

**Independent Test**: Login as admin, seed an active project (modules at 40/30 sum 70), POST `{total_amount:"10000.00"}` → assert HTTP 201 with `company_amount="3000.00"`, `developer_amount="7000.00"`, two children of `"4000.00"` and `"3000.00"`. Repeat as manager (HTTP 201) and developer (HTTP 403).

### Tests for User Story 1 ⚠️ (write FIRST)

- [ ] T008 [P] [US1] Create test helper `backend/tests/_payments_helpers.py` with `seed_payment_for_project(client, project_id, total_amount, auth_header)` returning the JSON response, plus assertion helper `assert_sum_invariants(payment_dict)` checking `company_amount + developer_amount == total_amount` and `sum(child.amount) == developer_amount`
- [ ] T009 [P] [US1] Create `backend/tests/test_payments_generate.py` with ≥10 cases: admin happy path (40/30), manager happy path, developer 403, no token 401, project_id missing → 404, project status=`pending` → 422 "project is not yet active", project status=`completed` → 201, soft-deleted project → 404, share-sum drift after module soft-delete → 422 "module shares no longer sum to 70.00", `total_amount` missing → 422, `total_amount` <= 0 → 422, unknown field (`company_amount`) → 422, milestone case (two consecutive POSTs same project → two distinct Payment ids), rounding-residual case (`total_amount="100.01"` shares 40/30 → assert children sum exactly to `developer_amount`)

### Implementation for User Story 1

- [ ] T010 [US1] Implement `Payment` and `DeveloperPayment` SQLModels in `backend/app/modules/payments/model.py` per `data-model.md` (table args with FK + CHECK constraints, server_default for `created_at`)
- [ ] T011 [US1] Implement closed Pydantic schemas in `backend/app/modules/payments/schema.py`: `PaymentGenerateRequest` (`total_amount: Decimal` `gt=0`, `model_config = ConfigDict(extra="forbid")`), `PaymentRead`, `DeveloperPaymentRead`, `DeveloperPaymentMineRead` (extends Read with `project_id`), `PaymentDetailRead` (PaymentRead + `developer_breakdown: list[DeveloperPaymentRead]`). Money fields use `Decimal` (Pydantic v2 default emits string)
- [ ] T012 [US1] Implement repository helpers in `backend/app/modules/payments/repository.py`: `insert_payment_with_children(session, payment, children) -> Payment`, `get_payment(session, payment_id) -> Payment | None`, `list_payment_children(session, payment_id) -> list[DeveloperPayment]` (ordered by `id` asc)
- [ ] T013 [US1] Implement service-layer typed exceptions in `backend/app/modules/payments/service.py`: `ProjectNotFound`, `ProjectNotBillable`, `ShareSumDrift`, `InvalidTotalAmount` (mapping per `contracts/access-control-matrix.md`)
- [ ] T014 [US1] Implement `_distribute(developer_amount: Decimal, modules: list[ProjectModule]) -> list[ChildSlice]` private helper in `service.py` with banker's rounding + largest-share residual absorption (ties broken by `developer_id` asc) per `data-model.md` § "Distribution algorithm"
- [ ] T015 [US1] Implement `generate_payment_distribution(session, project_id, total_amount, caller) -> Payment` in `service.py`: call `projects.repository.get_project_by_id` → 404 if missing/soft-deleted; check project.status in {active, completed} → `ProjectNotBillable`; call `projects.repository.list_active_modules(project_id)` → verify shares sum to `Decimal("70.00")` → `ShareSumDrift`; compute company_amount = total*0.30, developer_amount = total*0.70 (banker's rounding 2dp); call `_distribute`; build Payment + N DeveloperPayments; persist atomically via `repository.insert_payment_with_children`; emit INFO log line per FR-021
- [ ] T016 [US1] Implement `POST /payments/generate/{project_id}` route in `backend/app/modules/payments/routes.py` using `Depends(get_current_user)` + `Depends(require_any("admin", "manager"))`. Route body: validate input via `PaymentGenerateRequest`, call `service.generate_payment_distribution`, map typed exceptions to HTTP via a single `try/except` block (no business logic in routes — FR-024). Return `PaymentDetailRead` with HTTP 201
- [ ] T017 [US1] Run `backend/scripts/audit_payments_imports.sh` and confirm PASS (no forbidden imports in payments module)
- [ ] T018 [US1] Run `cd backend && uv run pytest tests/test_payments_generate.py -v` — all 10+ tests pass

**Checkpoint**: US1 fully functional. A Payment can be generated and its sum invariants hold. The MVP boundary stops here.

---

## Phase 4: User Story 2 — Admin/Manager Read Payments (Priority: P1)

**Goal**: Admin and manager call `GET /payments` (optionally filtered by `project_id`) and `GET /payments/{id}` to inspect Payments and their breakdowns. Developers receive 403 on both endpoints.

**Independent Test**: Seed three Payments across two projects. Admin `GET /payments` → 3 in id order; admin `GET /payments?project_id=p1` → 2; admin `GET /payments/{id}` → PaymentDetailRead with developer_breakdown. Manager same. Developer → 403.

### Tests for User Story 2 ⚠️

- [ ] T019 [P] [US2] Create `backend/tests/test_payments_read.py` with ≥6 cases: admin list (all Payments in stable id order), admin list with `?project_id=` filter, admin GET /{id} returns PaymentDetailRead with developer_breakdown, admin GET /{id} for missing id → 404, manager list + GET /{id} → 200, developer list → 403, developer GET /{id} → 403, no auth → 401

### Implementation for User Story 2

- [ ] T020 [US2] Add `list_payments(session, project_id: int | None = None) -> list[Payment]` to `backend/app/modules/payments/repository.py` — ordered by `id` asc, optionally filtered
- [ ] T021 [US2] Add `PaymentNotFound` exception to `service.py`; implement `get_payment_detail(session, payment_id) -> PaymentDetail` (parent + children) and `list_payments(session, project_id)` service helpers (RBAC enforced at the route layer via `Depends`)
- [ ] T022 [US2] Add `GET /payments` and `GET /payments/{id}` routes to `routes.py` guarded by `Depends(require_any("admin", "manager"))`. Map `PaymentNotFound → 404`. Both return shapes per `contracts/openapi.yaml`
- [ ] T023 [US2] Run `cd backend && uv run pytest tests/test_payments_read.py -v` — all 6+ tests pass

**Checkpoint**: US1 + US2 work independently; admin/manager can generate and inspect.

---

## Phase 5: User Story 3 — Developer Self-Service Earnings (Priority: P1)

**Goal**: Developer calls `GET /payments/developer/me` and sees only their own DeveloperPayment rows. Admin/manager → 403.

**Independent Test**: Seed two developers with assignments on different modules; one Payment. Dev1 → exactly one row (theirs); Dev2 → exactly one row (theirs); Dev3 (no assignments) → `[]`. Admin/manager → 403. Soft-deleting the project does not hide rows.

### Tests for User Story 3 ⚠️

- [ ] T024 [P] [US3] Create `backend/tests/test_payments_developer_me.py` with ≥6 cases: dev1 sees own row(s) only, dev2 sees only their own, dev3 with no assignments → `[]` 200, admin → 403, manager → 403, no auth → 401, soft-deleted project does not hide rows (FR-017), per-row confidentiality (dev1 cannot see dev2 row even by id), stable `created_at` asc ordering across multiple Payments

### Implementation for User Story 3

- [ ] T025 [US3] Add `list_developer_payments_for_user(session, developer_id: int) -> list[tuple[DeveloperPayment, int]]` to `repository.py` — joins `payment` to expose `project_id`, `WHERE developer_id = :id ORDER BY developer_payment.created_at ASC, developer_payment.id ASC`
- [ ] T026 [US3] Add `list_my_earnings(session, caller_user_id) -> list[DeveloperPaymentMine]` service helper that calls the repository helper and shapes the response into `DeveloperPaymentMineRead`
- [ ] T027 [US3] Add `GET /payments/developer/me` route guarded by `Depends(require_role("developer"))`. Returns `list[DeveloperPaymentMineRead]`
- [ ] T028 [US3] Run `cd backend && uv run pytest tests/test_payments_developer_me.py -v` — all 6+ tests pass

**Checkpoint**: US1 + US2 + US3 independently functional.

---

## Phase 6: User Story 4 — Admin Marks Developer Payments Paid (Priority: P2)

**Goal**: Admin calls `PATCH /payments/{id}/status` with either `{developer_payment_id: <id>}` or `{target: "all"}`. The targeted child(ren) flip pending → paid; parent re-derives (pending → partial → paid). Manager/developer → 403.

**Independent Test**: Seed Payment with 3 children. PATCH first child → parent partial. PATCH second → parent partial. PATCH third → parent paid. Then on a fresh Payment, PATCH `{target:"all"}` → parent paid in one call. Re-PATCH `{target:"all"}` on a fully-paid Payment → 200 idempotent. Manager → 403.

### Tests for User Story 4 ⚠️

- [ ] T029 [P] [US4] Create `backend/tests/test_payments_status.py` with ≥8 cases: admin marks one child paid → parent partial, admin marks all children one by one → parent eventually paid, admin `{target:"all"}` on fresh pending → parent paid, idempotent re-PATCH `{target:"all"}` on already-paid → 200 no-op, admin with mismatched `developer_payment_id` (belongs to different Payment) → 422 "does not belong to this payment", admin empty body → 422, admin both fields supplied → 422 "mutually exclusive", admin unknown field → 422, manager → 403, developer → 403, missing payment_id → 404, no auth → 401

### Implementation for User Story 4

- [ ] T030 [US4] Add `PaymentStatusPatch` closed schema to `schema.py`: `developer_payment_id: int | None`, `target: Literal["all"] | None`, `model_config = ConfigDict(extra="forbid")`. Mutual-exclusion + non-empty validation lives in the service layer (typed exceptions) so HTTP detail messages are precise
- [ ] T031 [US4] Add `mark_developer_payment_paid(session, developer_payment_id) -> None` and `mark_all_pending_paid(session, payment_id) -> None` to `repository.py` — single-statement updates only
- [ ] T032 [US4] Add `DeveloperPaymentNotInThisPayment`, `MutuallyExclusiveFields`, `EmptyStatusPatchBody` exceptions; add `_derive_parent_status(children: list[DeveloperPayment]) -> str` helper; implement `update_payment_status(session, payment_id, payload) -> PaymentDetail` that: validates exactly-one-of (developer_payment_id, target); 404 if Payment missing; if `developer_payment_id` set, verifies it belongs to this Payment (else 422); flips child(ren) to paid; re-derives parent status; persists atomically; emits INFO log line per FR-021
- [ ] T033 [US4] Add `PATCH /payments/{id}/status` route guarded by `Depends(require_admin)`. Returns `PaymentDetailRead`
- [ ] T034 [US4] Run `cd backend && uv run pytest tests/test_payments_status.py -v` — all 8+ tests pass

**Checkpoint**: Lifecycle complete. Payments can be generated, read, surfaced to developers, and disbursed.

---

## Phase 7: User Story 5 — Aggregate Summary (Priority: P3)

**Goal**: Admin or manager calls `GET /payments/summary` to retrieve aggregate sums (`total_billed`, `total_company_reserve`, `total_developer_disbursed`) plus a `by_status` breakdown (count + sum for each of `pending|partial|paid`). Developer → 403.

**Independent Test**: Seed three Payments across two projects; mark some children paid. Admin `GET /payments/summary` → 200 with sums matching the manual computation. Manager → 200. Developer → 403. Empty system → all sums `"0.00"`, all counts `0`.

### Tests for User Story 5 ⚠️

- [ ] T035 [P] [US5] Create `backend/tests/test_payments_summary.py` with ≥3 cases: admin summary with mixed-status Payments (sums + counts match expectation), manager summary 200, developer summary 403, empty system summary (all zeros), no auth → 401

### Implementation for User Story 5

- [ ] T036 [US5] Add `summary_aggregates(session) -> SummaryRow` to `repository.py` — single SUM/COUNT query grouped by `payment.status`; return totals and per-status buckets as Decimals
- [ ] T037 [US5] Add `PaymentSummaryRead` + `PaymentSummaryBucket` schemas to `schema.py` per `contracts/openapi.yaml`. Add `get_payment_summary(session) -> PaymentSummaryRead` service helper that wraps the repository row in the canonical Decimal-as-string shape
- [ ] T038 [US5] Add `GET /payments/summary` route guarded by `Depends(require_any("admin", "manager"))`. Returns `PaymentSummaryRead`
- [ ] T039 [US5] Run `cd backend && uv run pytest tests/test_payments_summary.py -v` — all 3+ tests pass

**Checkpoint**: All five user stories independently functional. SC-006 (≥35 tests) reached.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, regression sweep, smoke test, and PHR-ready end-state.

- [x] T040 [P] Run `bash backend/scripts/audit_payments_imports.sh` — must PASS (FR-023 / SC-007)
- [x] T041 [P] Run full test sweep: `cd backend && uv run pytest -v` — every prior feature (auth, users, clients, projects) plus the 35+ new payments tests must pass; total expected ≥213
- [x] T042 Smoke test: `cd backend && uv run uvicorn app.main:app --reload`, curl `http://localhost:8000/openapi.json | jq '.paths | keys[] | select(startswith("/payments"))'` — must list 6 path templates (5 GET/POST/PATCH endpoints + the parameterised `{id}` variants)
- [x] T043 [P] Walk through every command in `specs/006-payments-distribution/quickstart.md` against the running server — verify all 7 happy paths and the 5 error responses
- [x] T044 Verify `app/main.py` is unchanged (payments already in `MODULE_REGISTRY` at `/payments` — no edit needed)
- [x] T045 Generate the green-stage PHR `history/prompts/006-payments-distribution/0004-implement-payments-module.green.prompt.md` summarising all phases, referencing the test counts and audit-script result

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies — can start immediately
- **Phase 2 (Foundational)**: depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: depends on Phase 2; the MVP boundary
- **Phase 4 (US2)**: depends on Phase 2; can run in parallel with Phase 3 if staffed
- **Phase 5 (US3)**: depends on Phase 2; can run in parallel with Phases 3/4 if staffed
- **Phase 6 (US4)**: depends on Phase 3 (needs Payments to mark paid against)
- **Phase 7 (US5)**: depends on Phase 3 + Phase 6 (summary by_status counts only become interesting once status transitions exist; the endpoint can be implemented sooner but its tests need US4 fixtures)
- **Phase 8 (Polish)**: depends on Phases 3–7 complete

### User Story Dependencies

- **US1 (P1)**: independent after Foundational — pure write path
- **US2 (P1)**: independent after Foundational — read path; uses US1 fixtures in tests but does not depend on US1 *code*
- **US3 (P1)**: independent after Foundational — developer-scoped read; uses US1 fixtures but not US1 code
- **US4 (P2)**: depends on US1 (a Payment must exist before its status can flip)
- **US5 (P3)**: depends on US1 (sums require Payments). Tests use mixed-status fixtures, which depend on US4 paths

### Within Each User Story

- Tests written first (or alongside) — must FAIL before implementation
- Models → repository → service → routes (every story respects the layer order)
- Audit script kept green throughout — re-run any time `payments/**` imports change

### Parallel Opportunities

- T001–T003 (Phase 1 setup) — all parallelizable
- T008 + T019 + T024 + T029 + T035 (test scaffolds across stories) — all parallelizable since each touches its own test file
- Within US1: T010 (model) and T011 (schema) can be parallel; both block T012 (repository) and T013/T014 (service)
- US2 + US3 implementation can fully proceed in parallel by different developers once Phase 2 is done
- T040 + T041 + T043 (audit + tests + quickstart) can run in parallel during Phase 8

---

## Parallel Example: User Story 1

```bash
# Open the test scaffold and the model in parallel:
Task: "Create test helper backend/tests/_payments_helpers.py" (T008)
Task: "Create backend/tests/test_payments_generate.py with 10+ cases" (T009)
Task: "Implement Payment + DeveloperPayment SQLModels in backend/app/modules/payments/model.py" (T010)
Task: "Implement closed Pydantic schemas in backend/app/modules/payments/schema.py" (T011)

# After T010 + T011 land, the following form a sequential chain:
T012 (repository) → T013 (typed exceptions) → T014 (_distribute) → T015 (generate_payment_distribution) → T016 (route)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3 — all P1)

1. Phase 1 (Setup) → Phase 2 (Foundational) — DB ready, audit gate live
2. Phase 3 (US1) — Payment can be generated atomically; SC-001 verified
3. Phase 4 (US2) — admins/managers can read and inspect
4. Phase 5 (US3) — developers see their earnings
5. **STOP & VALIDATE** — run quickstart.md sections 0–4, confirm RBAC matrix
6. Deploy/demo: read-only payment ledger with no disbursement path yet

### Incremental Delivery

7. Phase 6 (US4) — admins can disburse; lifecycle closes
8. Phase 7 (US5) — dashboard summary lights up
9. Phase 8 (Polish) — full sweep + audit + green PHR

### Parallel Team Strategy

With three developers post-Phase 2:

- Developer A: US1 (Phase 3) → US4 (Phase 6) — owns the write path end-to-end
- Developer B: US2 (Phase 4) — admin/manager reads
- Developer C: US3 (Phase 5) → US5 (Phase 7) — developer view + summary

---

## Notes

- [P] tasks = different files, no incomplete dependencies
- [Story] label maps every task to its user story for traceability
- Every user story is independently completable + testable (verified at each Checkpoint)
- Tests must FAIL before implementation lands; run the targeted file with `uv run pytest tests/test_payments_*.py -v` after each implementation task
- Commit after each Checkpoint (one commit per user story is the recommended cadence)
- `audit_payments_imports.sh` is the FR-023 boundary — re-run it after every service.py / repository.py edit
- No business logic in routes (FR-024) — every route body is a thin try/except mapping typed exceptions to HTTP
- Append-only ledger (FR-019): no `PaymentUpdate` schema, no PATCH /payments/{id} (only `/payments/{id}/status`); the schema layer enforces this by omission
- Decimal-as-string on the wire (R10): `total_amount`, `company_amount`, `developer_amount`, `share_percentage`, `amount`, summary sums all serialise as JSON strings; consumer parsers must NOT cast to float
