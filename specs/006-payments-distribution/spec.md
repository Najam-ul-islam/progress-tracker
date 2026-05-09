# Feature Specification: Payments Distribution

**Feature Branch**: `006-payments-distribution`
**Created**: 2026-05-07
**Status**: Draft
**Input**: User description (verbatim, condensed):
> MODULE: Payments. Handle project payment distribution, developer earnings calculation, and company reserve tracking. Entities: Payment (id, project_id FK, total_amount, company_amount, developer_amount, status pending|partial|paid, created_at) and DeveloperPayment (id, payment_id FK, developer_id FK, module_id FK, share_percentage, amount, status, created_at). Logic: 30% → company reserve, 70% → developers, distributed by each module's `share_percentage` (which already sums to 70). Endpoints: POST /payments/generate/{project_id}, GET /payments, GET /payments/{id}, GET /payments/developer/me, PATCH /payments/{id}/status. RBAC: admin = full; manager = generate/view; developer = view own earnings only. Validation: project must exist; module shares ≤ 70%; developer must belong to assigned module. NOT responsible for payment gateway integration, authentication, or project CRUD. Constraints: modular architecture, centralised calculation logic, no duplicate payment calculations.

**Resolved decisions** (from `/sp.specify` clarifier this session):

1. **Generation gate**: a Payment may be generated only against a project whose status is `active` or `completed`. Pending projects (whose module shares have not yet reached 70%) cannot be billed.
2. **Cardinality — many Payments per project (milestones)**: each `POST /payments/generate/{project_id}` creates a new Payment record. Callers may bill in slices (e.g., milestone 1, milestone 2). The sum of a project's Payments need not equal `project.total_amount` and is treated as the operator's accounting decision; the spec does not enforce it.
3. **Status semantics**: `Payment.status` is **derived** from its `DeveloperPayment` children plus the company-reserve sub-row. The system rolls the parent up automatically:
   - all children `pending` → `Payment.status = "pending"`,
   - any-but-not-all children `paid` → `Payment.status = "partial"`,
   - every child `paid` → `Payment.status = "paid"`.
   Admins mark individual rows paid; the operator never PATCHes `Payment.status` to a freeform value.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin or manager generates a payment distribution (Priority: P1)

An admin or manager calls `POST /payments/generate/{project_id}` with a JSON body containing `total_amount` (the slice they wish to bill — typically a milestone). The system confirms the target project is `active` or `completed`, computes `company_amount = total_amount × 30%` and `developer_amount = total_amount × 70%`, then creates one `DeveloperPayment` row per active module on the project, allocating each developer a slice proportional to that module's `share_percentage` (i.e., `developer_amount × module.share_percentage / 70`). The Payment and its DeveloperPayments are persisted atomically and returned to the caller.

**Why this priority**: Without generation, no other endpoint has anything to read, summarise, or mark paid. P1 because every downstream story depends on the existence of a Payment record. It also exercises the projects ↔ modules ↔ users ↔ payments integration end-to-end.

**Independent Test**: Login as admin, seed an active client and a project whose modules' shares already sum to 70 (so the project can be activated). Activate it, then `POST /payments/generate/{project.id}` with `{total_amount:"10000.00"}`. Assert HTTP 201 and a body containing `company_amount = "3000.00"`, `developer_amount = "7000.00"`, plus one `DeveloperPayment` per active module. Each child row's `amount` equals `developer_amount × module.share_percentage / 70`. Repeat with the manager role and assert HTTP 201. Repeat with a developer role and assert HTTP 403.

**Acceptance Scenarios**:

1. **Given** an admin and a project at `status = "active"` with two active modules of shares 40 and 30, **When** `POST /payments/generate/{project.id}` is called with `{total_amount:"10000.00"}`, **Then** the response is HTTP 201 with `Payment{total_amount:"10000.00", company_amount:"3000.00", developer_amount:"7000.00", status:"pending"}` and exactly two `DeveloperPayment` children of amounts `"4000.00"` and `"3000.00"` respectively.
2. **Given** the same project but at `status = "completed"`, **When** the same request is made, **Then** the response is still HTTP 201 (FR-001 — completed projects may also be billed).
3. **Given** a project at `status = "pending"`, **When** the same request is made, **Then** the response is HTTP 422 with `detail = "project is not yet active"` (FR-001).
4. **Given** a project that does not exist or is soft-deleted, **When** the same request is made, **Then** the response is HTTP 404.
5. **Given** an authenticated manager, **When** `POST /payments/generate/{project.id}` is called against a valid active project, **Then** the response is HTTP 201.
6. **Given** an authenticated developer, **When** the same request is made, **Then** the response is HTTP 403.
7. **Given** no `Authorization` header, **When** the same request is made, **Then** the response is HTTP 401.
8. **Given** a payload missing `total_amount`, with `total_amount <= 0`, or with an unknown field (e.g., `company_amount`), **When** `POST /payments/generate/{project.id}` is called, **Then** the response is HTTP 422 (closed schema).
9. **Given** an active project whose ACTIVE modules' `share_percentage` values sum to less than 70 (e.g., a module was soft-deleted after activation), **When** `POST /payments/generate/{project.id}` is called, **Then** the response is HTTP 422 with `detail = "module shares no longer sum to 70.00"` (FR-005).
10. **Given** the same project billed twice with `total_amount:"5000.00"` then `total_amount:"3000.00"`, **When** both requests succeed, **Then** the project has two distinct Payment rows (milestone billing — FR-002) and the second response references a different `Payment.id`.

---

### User Story 2 — Admin or manager lists and reads payments (Priority: P1)

Admins and managers call `GET /payments` to list every payment across the system, optionally filtered by `project_id`, and `GET /payments/{id}` to fetch one Payment with its full breakdown (developer-by-developer, module-by-module, plus the company-reserve line). The read surface is what every accounting view, status update, and audit consumes.

**Why this priority**: P1 because generation alone produces opaque rows; the operator must be able to verify the breakdown matches the expected distribution before marking anything paid, and an auditor must be able to retrieve a Payment by id long after it was generated. Read also unblocks the developer self-service view (US3) and the status-update flow (US4).

**Independent Test**: Seed two projects, generate one Payment per project, and a second Payment on the first project. Login as admin, call `GET /payments` and assert all three Payments are returned in stable order (id ascending). Call `GET /payments?project_id={p1.id}` and assert exactly two records are returned. Call `GET /payments/{payment.id}` and assert the full breakdown shape. Login as manager and repeat the same assertions. Login as developer and assert HTTP 403 on the list and HTTP 403 on the per-id read.

**Acceptance Scenarios**:

1. **Given** at least two Payments exist (across one or many projects), **When** an admin calls `GET /payments`, **Then** the response is HTTP 200 with a JSON array of every Payment in stable id order, each entry using the `PaymentRead` shape (`id, project_id, total_amount, company_amount, developer_amount, status, created_at`).
2. **Given** at least two Payments belonging to two different projects, **When** an admin calls `GET /payments?project_id={p1.id}`, **Then** the response is HTTP 200 and contains only the Payments whose `project_id` matches.
3. **Given** an admin, **When** `GET /payments/{id}` is called for a Payment that exists, **Then** the response is HTTP 200 with `PaymentRead` plus a `developer_breakdown: [DeveloperPaymentRead, ...]` field listing each child row (`id, developer_id, module_id, share_percentage, amount, status`).
4. **Given** an admin, **When** `GET /payments/{id}` is called for a Payment id that does not exist, **Then** the response is HTTP 404.
5. **Given** a manager, **When** `GET /payments` and `GET /payments/{id}` are called, **Then** both succeed (HTTP 200).
6. **Given** a developer, **When** `GET /payments` is called, **Then** the response is HTTP 403 (developers must use the self-service endpoint instead).
7. **Given** a developer, **When** `GET /payments/{id}` is called for any Payment, **Then** the response is HTTP 403 (the developer cannot read aggregate breakdowns even for projects they are assigned to — US3 is the only read surface they have).
8. **Given** no `Authorization` header, **When** any read endpoint is called, **Then** the response is HTTP 401.

---

### User Story 3 — Developer reads only their own earnings (Priority: P1)

A developer calls `GET /payments/developer/me` to see every `DeveloperPayment` row whose `developer_id` matches their authenticated user id, across every project they have ever been assigned to. The response is a developer-scoped view, not the manager's aggregate view: it returns child rows (with each row's parent `payment_id`, `project_id`, `module_id`, `share_percentage`, `amount`, and `status`) but never reveals other developers' amounts or the company reserve.

**Why this priority**: P1 because earning visibility is the core value the platform offers developers — without it, developers have no way to confirm what they have been allocated for any given milestone. Per FR-008 / FR-026 (continuity from prior modules), per-row confidentiality is non-negotiable.

**Independent Test**: Seed a project with two modules assigned to two different developers. Generate one Payment. Login as `developer_1` and call `GET /payments/developer/me`; assert the response contains exactly one row whose `module_id` is the module assigned to `developer_1`. Repeat as `developer_2`; assert exactly one row, the other module's row. Login as a third developer with no assignments; assert the response is HTTP 200 with an empty array. Login as admin/manager and assert HTTP 403 (the endpoint is developer-scoped — admins see `GET /payments/{id}` instead).

**Acceptance Scenarios**:

1. **Given** a developer with at least one DeveloperPayment row, **When** they call `GET /payments/developer/me`, **Then** the response is HTTP 200 with a JSON array containing every `DeveloperPayment` row whose `developer_id` matches the caller, each entry shaped as `DeveloperPaymentRead` plus a denormalised `project_id` for navigation.
2. **Given** a developer with zero DeveloperPayment rows, **When** they call `GET /payments/developer/me`, **Then** the response is HTTP 200 with `[]`.
3. **Given** developer A and developer B both with assignments on different projects, **When** developer A calls the endpoint, **Then** only developer A's rows are returned and developer B's rows are not visible (FR-008 confidentiality — even by id).
4. **Given** an admin, **When** they call `GET /payments/developer/me`, **Then** the response is HTTP 403 (the endpoint is reserved for developers; admins read aggregates).
5. **Given** a manager, **When** they call `GET /payments/developer/me`, **Then** the response is HTTP 403 (managers read aggregates).
6. **Given** no `Authorization` header, **When** the endpoint is called, **Then** the response is HTTP 401.
7. **Given** a Payment whose underlying project has been soft-deleted between generation and read, **When** the assigned developer calls the endpoint, **Then** the row remains visible (FR-024 — soft-deleting a project does not erase historical earnings; payments are an audit trail).

---

### User Story 4 — Admin marks individual developer payments paid (Priority: P2)

An admin calls `PATCH /payments/{id}/status` with a body identifying which child(ren) to mark paid (either by `developer_payment_id` or by the special token `all`). The system flips the targeted `DeveloperPayment.status` from `pending` to `paid`, automatically marks the company-reserve sub-row paid the first time the parent transitions out of `pending`, and recomputes the parent `Payment.status`:

- every child `pending` → `pending`,
- some-but-not-all child `paid` → `partial`,
- every child `paid` → `paid`.

This is the admin's tool for tracking real disbursements once they are sent out of band (bank transfer, wire, payroll cycle).

**Why this priority**: P2 because the platform is useful for read-only viewing of distributions on day one, but the lifecycle of a Payment cannot be closed without a status path. Marking paid also feeds the developer's view (FR-013 — the developer sees their row flip from `pending` to `paid`).

**Independent Test**: Seed a project with three modules, generate one Payment, then login as admin and `PATCH /payments/{id}/status` with `{developer_payment_id: <child_id_1>}`. Assert HTTP 200 and that the parent `Payment.status` is now `partial`. Repeat for the second child; parent still `partial`. Repeat for the third; parent flips to `paid`. Then repeat the test with `{target: "all"}` against a fresh Payment and assert the parent jumps `pending → paid` in one call. Confirm a manager calling the endpoint gets HTTP 403.

**Acceptance Scenarios**:

1. **Given** an admin and a Payment in `pending` with three `DeveloperPayment` children, **When** they call `PATCH /payments/{id}/status` with `{developer_payment_id: <one_of_the_children>}`, **Then** the response is HTTP 200, that single child's `status` is `paid`, and the parent's `status` is `partial`.
2. **Given** the same Payment after one child has been marked paid, **When** the admin calls the endpoint with `{target: "all"}`, **Then** the response is HTTP 200, every remaining child's `status` is `paid`, and the parent's `status` is `paid`.
3. **Given** a Payment that already has every child `paid` (parent `paid`), **When** the admin calls the endpoint with `{target: "all"}`, **Then** the response is HTTP 200 (idempotent — no rows change, parent stays `paid`).
4. **Given** an admin, **When** they call the endpoint with `{developer_payment_id: <id_belonging_to_a_different_payment>}`, **Then** the response is HTTP 422 with `detail = "developer_payment_id does not belong to this payment"`.
5. **Given** an admin, **When** they call the endpoint with no body, an empty body, an unknown field, or both `developer_payment_id` AND `target` set, **Then** the response is HTTP 422 (closed schema; mutually exclusive fields).
6. **Given** a manager, **When** they call the endpoint, **Then** the response is HTTP 403 (manager may generate/view but not disburse — admin-only).
7. **Given** a developer, **When** they call the endpoint, **Then** the response is HTTP 403.
8. **Given** an admin, **When** they call the endpoint for a `payment_id` that does not exist, **Then** the response is HTTP 404.

---

### User Story 5 — Anyone with manager-or-above scope reads the company-reserve summary (Priority: P3)

An admin or manager calls `GET /payments` (already covered for the row view in US2) and a derived summary endpoint `GET /payments/summary` returns aggregate totals across every Payment in the system: `total_billed`, `total_company_reserve`, `total_developer_disbursed`, plus per-status breakdowns (count + sum of `pending`, `partial`, `paid`). This is the dashboard view of "how much has flowed through the platform."

**Why this priority**: P3 because the per-Payment view (US2) already discloses the same numbers; the summary is convenience, not a blocker. Useful for the manager's dashboard and the admin's reconciliation workflow but not strictly necessary on day one.

**Independent Test**: Seed three Payments across two projects, mark some children paid, and call `GET /payments/summary` as an admin. Assert HTTP 200 and that the returned counts and sums match the manually-computed expectations. Repeat as manager (also HTTP 200). Repeat as developer (HTTP 403).

**Acceptance Scenarios**:

1. **Given** an admin and three Payments in the system with mixed statuses, **When** they call `GET /payments/summary`, **Then** the response is HTTP 200 with `{total_billed, total_company_reserve, total_developer_disbursed, by_status: {pending: {count, sum}, partial: {count, sum}, paid: {count, sum}}}`.
2. **Given** zero Payments in the system, **When** an admin calls `GET /payments/summary`, **Then** the response is HTTP 200 with all sums equal to `"0.00"` and all counts equal to `0`.
3. **Given** a manager, **When** they call the endpoint, **Then** the response is HTTP 200.
4. **Given** a developer, **When** they call the endpoint, **Then** the response is HTTP 403.

---

### Edge Cases

- **Module soft-deleted between activation and generation**: when activation requires sum == 70, and a module is later soft-deleted, the active modules' shares now sum to less than 70. Generating a Payment on such a project must fail with HTTP 422 (FR-005), not silently distribute a partial amount that fails to total `developer_amount`.
- **Module added between two Payments on the same project**: a manager activates the project, generates Payment #1 (distributing across modules A+B at 40/30), then adds module C (which under FR-013 of feature 005 cannot be added on a non-pending project, but the spec must still tolerate the rare case if reactivation flows are added later). For Payment #2 the distribution uses the *current* set of active modules at generation time. The historical Payment #1 is never recomputed.
- **Developer reassigned between two Payments**: each Payment freezes `developer_id` per child at generation time. If a module is re-assigned to a different developer, only future Payments reflect the change.
- **Rounding**: Decimal arithmetic at 2 decimal places means `developer_amount × share / 70` is not always exact. The system rounds each child to 2 dp using banker's rounding (ROUND_HALF_EVEN); the largest child absorbs the residual cent so the children sum to `developer_amount` exactly (no penny-loss).
- **Soft-deleted parent project after generation**: a Payment is an audit trail and remains readable indefinitely. Soft-deleting the project does not cascade and does not hide the Payment from US2 reads or US3 self-service reads (FR-024).
- **Concurrent generation**: two operators may race to generate Payments on the same project. Both should succeed (FR-002 — milestones). The resulting Payments differ by `id` and `created_at`.
- **Status transition once a Payment is fully `paid`**: there is no reverse path. The spec does not define an "un-pay" operation. Marking-paid is monotonic.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 — Generation gate**: System MUST allow `POST /payments/generate/{project_id}` only when the target project's `status` is `active` or `completed`. Any other status MUST return HTTP 422.
- **FR-002 — Many-Payments-per-project (milestones)**: System MUST allow multiple `Payment` records to coexist for one `project_id`. The repeat-call MUST create a fresh row, not return or mutate an existing one.
- **FR-003 — 30/70 split**: System MUST compute `Payment.company_amount = total_amount × 30%` and `Payment.developer_amount = total_amount × 70%` exactly, using Decimal arithmetic at 2 decimal places. The two MUST sum to `total_amount`.
- **FR-004 — Per-developer distribution**: System MUST create one `DeveloperPayment` row per active module on the project at generation time. Each child row's `amount` MUST equal `Payment.developer_amount × module.share_percentage / 70`, rounded to 2 dp; the rounding residual MUST be absorbed by the largest child so the children sum exactly to `Payment.developer_amount`.
- **FR-005 — Share-sum guard at generation**: System MUST verify, at generation time, that the active modules' `share_percentage` values still sum to exactly 70.00. Any drift (e.g., a module soft-deleted after activation) MUST yield HTTP 422 with detail `"module shares no longer sum to 70.00"`.
- **FR-006 — RBAC on generate / list / read aggregate / mark paid**: System MUST allow `POST /payments/generate/{id}`, `GET /payments`, `GET /payments?project_id=`, `GET /payments/{id}`, and `GET /payments/summary` for admin and manager only. `PATCH /payments/{id}/status` MUST be admin-only. Developers MUST be denied with HTTP 403 on every aggregate endpoint.
- **FR-007 — Developer self-service**: System MUST expose `GET /payments/developer/me` that returns every `DeveloperPayment` row whose `developer_id` equals the authenticated caller's user id. Admin and manager MUST be denied (HTTP 403) on this endpoint — it is developer-scoped.
- **FR-008 — Per-row confidentiality (continuity from features 003 / 005)**: System MUST never disclose another developer's `DeveloperPayment.amount`, `share_percentage`, or `status` to a developer through any endpoint.
- **FR-009 — Closed schemas (continuity from feature 005)**: All request bodies (`PaymentGenerateRequest`, `PaymentStatusPatch`) MUST reject unknown fields and MUST reject server-set fields (`id`, `company_amount`, `developer_amount`, `status`, `created_at`) if supplied. Violations MUST return HTTP 422.
- **FR-010 — Generation is atomic**: System MUST persist the parent `Payment` row and all `DeveloperPayment` children in a single transaction. A failure mid-distribution MUST roll back the parent row.
- **FR-011 — Status derivation**: System MUST derive `Payment.status` from its `DeveloperPayment` children on every status write: every child `pending` → `pending`, some-but-not-all `paid` → `partial`, every child `paid` → `paid`. The operator MUST NOT be able to set `Payment.status` to a freeform value.
- **FR-012 — Partial status path**: System MUST permit per-child status updates via `PATCH /payments/{id}/status` `{developer_payment_id: ...}` and a single `target: "all"` shortcut for marking every remaining `pending` child paid in one call. The two field names MUST be mutually exclusive (HTTP 422 if both supplied).
- **FR-013 — Developer status visibility**: System MUST surface the per-row `status` (`pending` or `paid`) to the assigned developer in `GET /payments/developer/me` so they can confirm receipt.
- **FR-014 — Self-service stable shape**: `GET /payments/developer/me` MUST return rows in stable `created_at` ascending order so the developer's view is consistent across calls.
- **FR-015 — Authentication**: System MUST require a valid `Authorization` header on every endpoint and MUST return HTTP 401 if absent or invalid (continuity from feature 002).
- **FR-016 — 401-then-403-then-404-then-422 ordering (continuity from features 003 / 004 / 005)**: For every endpoint, System MUST evaluate guards in order: missing/invalid token (401), insufficient role (403), missing target row (404), payload validation (422). The ordering is not negotiable.
- **FR-017 — Soft-deleted project does not hide payments**: System MUST keep all Payments and DeveloperPayments readable after the underlying project has been soft-deleted (FR-024 of feature 005).
- **FR-018 — Generation freezes referential snapshot**: System MUST freeze `developer_id` and `share_percentage` per `DeveloperPayment` at generation time. Subsequent edits to module `share_percentage` or `assigned_developer_id` MUST NOT retroactively recompute historical `DeveloperPayment.amount`.
- **FR-019 — No payment mutation outside the status endpoint**: System MUST NOT expose any way to edit `Payment.total_amount`, `Payment.company_amount`, `Payment.developer_amount`, `DeveloperPayment.amount`, or any timestamps after generation. Errors MUST be corrected by generating a corrective Payment, not by editing in place.
- **FR-020 — Summary aggregation**: `GET /payments/summary` MUST return `total_billed`, `total_company_reserve`, `total_developer_disbursed`, and a `by_status` breakdown with `count` + `sum` for each of `pending`, `partial`, `paid`. Sums MUST be returned as Decimal strings at 2 dp.
- **FR-021 — Logging**: System MUST emit structured INFO-level log lines for every generation (`payments.generate: payment_id=… project_id=… total=… children=…`) and every status transition (`payments.status: payment_id=… developer_payment_id=… new_status=… parent_status=…`).
- **FR-022 — No payment-gateway integration**: System MUST NOT attempt to debit cards, dispatch wires, or call any external billing service. Payments are an internal accounting record only. Out-of-band disbursement is the operator's responsibility; the system only tracks status.
- **FR-023 — Read-only sibling imports (continuity from feature 005's FR-027)**: The `payments` module MUST import only `projects.repository`, `users.repository`, `auth.dependencies`, and `auth.schema` from siblings. It MUST NOT import any sibling service or sibling routes module.
- **FR-024 — Modular layout**: Module MUST follow the six-file layout (`model.py`, `schema.py`, `repository.py`, `service.py`, `routes.py`, `dependencies.py`) used by features 002 / 003 / 004 / 005. All business rules in `service.py`, all SQL in `repository.py`, no logic in `routes.py`.

### Key Entities

- **Payment**: a billing slice against a project. Holds `id`, `project_id` (FK to `project.id`, ON DELETE RESTRICT), `total_amount` (Decimal 12,2 > 0), the derived `company_amount` (= 30% of `total_amount`) and `developer_amount` (= 70% of `total_amount`), the derived `status` (one of `pending | partial | paid`), and `created_at`. Many Payments per project are allowed (milestones). Once created, `total_amount` / `company_amount` / `developer_amount` are immutable; `status` flips automatically as children are marked paid.
- **DeveloperPayment**: a single developer's slice of a Payment. Holds `id`, `payment_id` (FK to `payment.id`, ON DELETE RESTRICT), `developer_id` (FK to `user.id`, ON DELETE RESTRICT — frozen at generation time), `module_id` (FK to `project_module.id`, ON DELETE RESTRICT — frozen at generation time), `share_percentage` (Decimal 5,2 — the snapshot of the module's share at generation time), `amount` (Decimal 12,2 — the actual cash slice computed via FR-004), `status` (one of `pending | paid`), and `created_at`. `amount`, `share_percentage`, `developer_id`, and `module_id` are immutable after generation; only `status` may flip.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 — Distribution correctness**: For every generated Payment, `company_amount + developer_amount == total_amount` exactly (no penny drift) and the sum of all child `DeveloperPayment.amount` equals `developer_amount` exactly. Verified by the test suite for at least three combinations of `total_amount` and module-share splits.
- **SC-002 — Generation latency**: 95% of `POST /payments/generate/{id}` calls complete in under 1 second, including the per-child distribution write, against a project with up to 10 active modules.
- **SC-003 — Per-row confidentiality**: 0 cross-developer leakage. Every test in the suite that probes developer A for developer B's rows MUST receive an empty result; no test fixture and no production response MUST disclose another developer's `amount`.
- **SC-004 — Status derivation accuracy**: The parent `Payment.status` reflects its children with 100% accuracy after every status PATCH. Verified by exhaustive enumeration of the three transitions (`pending → partial`, `partial → partial`, `partial → paid`) plus the idempotent `paid → paid` no-op.
- **SC-005 — Audit-trail durability**: After a project is soft-deleted, every Payment and DeveloperPayment row attached to it remains readable to admins, managers, and the originally-assigned developer.
- **SC-006 — Test coverage**: At least 35 test cases across the five user stories (US1: ≥10, US2: ≥6, US3: ≥6, US4: ≥8, US5: ≥3, plus edge cases). All MUST pass before merge to `main`.
- **SC-007 — Module isolation (FR-023)**: The audit script `audit_payments_imports.sh` passes with no forbidden imports (only `projects.repository`, `users.repository`, `auth.dependencies`, `auth.schema` are reachable from siblings).

## Assumptions

- The `Project.total_amount` field on the projects table is informational; the operator may bill milestones whose sum is less than, equal to, or greater than `Project.total_amount`. The spec deliberately does not enforce a relationship — that is an accounting policy, not a domain invariant.
- Currency is single (one ledger, one tenant). Multi-currency / FX conversion is out of scope.
- Tax (VAT, sales tax) is out of scope and not deducted before the 30/70 split. The operator inputs the post-tax `total_amount` they wish to distribute.
- "Company reserve" is a virtual concept tracked through the sum of `Payment.company_amount`. There is no `CompanyReserve` table; FR-020's `total_company_reserve` is derived on the fly from the Payment table.
- The developer-scoped `GET /payments/developer/me` returns a flat list of child rows; the spec does not define pagination on day one (a developer who has accumulated >10k rows is hypothetical and out of scope for the MVP).
- Marking-paid is monotonic — once a row is `paid`, the spec defines no path back to `pending`. Reconciliation errors are corrected by issuing a corrective Payment, not by reversing the original.
- The closed-schema rule, the soft-delete invisibility (`is_active = false → 404`), the 401-then-403-then-404-then-422 guard ordering, and the sibling-allow-list FR-023 are all reused **by reference** from features 002 / 003 / 004 / 005. Each is a contractual continuity, not a new requirement to re-derive in this spec.
