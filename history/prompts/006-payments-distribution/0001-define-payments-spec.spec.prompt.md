---
id: 0001
title: Define payments distribution spec
stage: spec
date: 2026-05-07
surface: agent
model: claude-sonnet-4-6
feature: 006-payments-distribution
branch: 006-payments-distribution
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: [payments, spec, rbac, distribution, audit-trail, milestones]
links:
  spec: specs/006-payments-distribution/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/006-payments-distribution/spec.md
  - specs/006-payments-distribution/checklists/requirements.md
  - history/prompts/006-payments-distribution/0001-define-payments-spec.spec.prompt.md
tests:
  - n/a (spec stage; tests will follow in /sp.tasks → /sp.implement)
---

## Prompt

/sp.specify

MODULE: Payments

PURPOSE:
Handle project payment distribution, developer earnings calculation, and company reserve tracking.

---

SCOPE:

Responsible for:
- Calculating project payments
- Distributing developer shares
- Tracking company reserve (30%)
- Managing payment records/history

NOT responsible for:
- Payment gateway integration
- Authentication
- Project CRUD

---

DEPENDENCIES:

- projects module
- users module
- auth module
- db/session

---

DATA MODELS:

1. Payment
- id
- project_id (FK)
- total_amount
- company_amount
- developer_amount
- status (pending | partial | paid)
- created_at

2. DeveloperPayment
- id
- payment_id (FK)
- developer_id (FK)
- module_id (FK)
- share_percentage
- amount
- status
- created_at

---

PAYMENT LOGIC:

- 30% → company reserve
- 70% → developers
- Module share_percentage determines developer earning
- Total module shares must equal 70%

---

FEATURES:

1. Generate payment distribution
2. Calculate developer earnings
3. View payment history
4. Mark payments as paid
5. View company reserve summary

---

INPUTS:

Generate Payment:
- project_id
- total_amount

Update Payment:
- status

---

OUTPUTS:

Payment Summary:
- project
- total_amount
- company_amount
- developer_breakdown

---

VALIDATION RULES:

- Project must exist
- Share totals cannot exceed 70%
- Developer must belong to assigned module

---

RBAC:

- Admin:
  - full access

- Manager:
  - generate/view payments

- Developer:
  - view own earnings only

---

API ENDPOINTS:

- POST /payments/generate/{project_id}
- GET /payments
- GET /payments/{id}
- GET /payments/developer/me
- PATCH /payments/{id}/status

---

SERVICE LAYER:

- calculate distributions
- validate shares
- generate summaries
- enforce RBAC

---

ROUTES:

- service layer only
- no business logic

---

SCHEMAS:

- PaymentCreate
- PaymentRead
- DeveloperPaymentRead
- PaymentStatusUpdate

---

CONSTRAINTS:

- modular architecture required
- centralized calculation logic
- no duplicate payment calculations

---

SUCCESS CRITERIA:

- Correct 30/70 calculations
- Accurate developer earnings
- RBAC enforced
- Payment summaries generated successfully

---

FOLLOW EXISTING PROJECT STRUCTURE STRICTLY.

## Response snapshot

Created branch `006-payments-distribution` (next id after `005-projects`)
and the spec scaffold under `specs/006-payments-distribution/`.

Three high-impact ambiguities surfaced and resolved with the user via
the in-session clarifier (one round of three questions, all answered):

1. **Generation gate** → project must be `active` or `completed` (rejects
   `pending` projects whose shares have not yet reached 70).
2. **Cardinality** → many Payments per project, milestone-billing model.
   The repeat-call always creates a fresh row.
3. **Status semantics** → `Payment.status` is *derived* from its
   `DeveloperPayment` children; admins flip individual children paid
   (or `target: "all"`); the parent rolls `pending → partial → paid`
   automatically. The operator may not PATCH `Payment.status` directly.

Drafted spec.md with 5 prioritised user stories (US1 generate / US2 admin
read / US3 developer self-service / US4 mark-paid / US5 summary), 24
Functional Requirements, a Key Entities block describing immutability
constraints and FK ON DELETE RESTRICT semantics, 7 measurable Success
Criteria, and an Assumptions block enumerating the audit-trail
invariant + currency/tax exclusions.

Notable invariants derived from the user's input plus prior-feature
continuities:

- **FR-018**: generation freezes `developer_id` and `share_percentage`
  per child — re-assigning a module later does NOT retroactively rewrite
  history.
- **FR-019**: `Payment.total_amount`/`company_amount`/`developer_amount`
  and `DeveloperPayment.amount` are immutable. Corrections are made by
  issuing a corrective Payment, never by editing the original.
- **FR-022**: explicitly excludes payment-gateway integration (out of
  scope, single most important boundary).
- **FR-023**: sibling-import allow-list (`projects.repository`,
  `users.repository`, `auth.dependencies`, `auth.schema`) — continuity
  from feature 005's FR-027.
- **Edge case**: rounding residuals are absorbed by the largest child so
  children sum exactly to `developer_amount` (no penny-loss).

Wrote the corresponding requirements checklist at
`specs/006-payments-distribution/checklists/requirements.md` with every
item ticked (no [NEEDS CLARIFICATION] markers remain) and notes
recording the three resolved decisions.

## Outcome

- ✅ Impact: Spec ready for `/sp.clarify` (likely no-op — three high-impact decisions resolved up front) or directly `/sp.plan`.
- 🧪 Tests: deferred to `/sp.tasks` and `/sp.implement` (≥35 cases per SC-006).
- 📁 Files: 3 — spec.md, checklists/requirements.md, this PHR.
- 🔁 Next prompts: `/sp.clarify` (optional sweep) → `/sp.plan` → `/sp.tasks` → `/sp.implement`.
- 🧠 Reflection: Compressing three pre-decisions into one batched clarifier kept the spec authoring loop to a single round-trip. The "many-Payments-per-project" choice changes the entire shape of the spec (no idempotency, no 409 conflict, no UPSERT semantics) — getting it up front saved a re-write.

## Evaluation notes (flywheel)

- Failure modes observed: `create-new-feature.ps1` PowerShell parser swallowed multiline arg via heredoc (`prompts/` was misread as a positional path); fell back to manually creating the prompts dir. Branch + spec.md were created correctly so the script's effect was salvageable.
- Graders run and results (PASS/FAIL): checklist self-review PASS (12/12 items ticked).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): when invoking the script with the verbose `/sp.*` template body, pass only the first paragraph as the description argument — the spec text itself goes into the spec body, not into the script.
