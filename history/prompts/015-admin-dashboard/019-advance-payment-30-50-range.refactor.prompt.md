---
id: 019
title: Advance Payment 30-50 Range Alignment
stage: refactor
date: 2026-06-21
surface: agent
model: claude-sonnet-4-6[1m]
feature: 015-admin-dashboard
branch: 015-admin-dashboard
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: ["payments", "projects", "backend", "validation", "business-rules"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - backend/app/modules/projects/service.py
 - backend/tests/test_advance_payment.py
 - backend/tests/test_projects_update.py
 - frontend/src/lib/payments.ts
tests:
 - "backend: pytest tests/test_advance_payment.py tests/test_projects_update.py (15 passed)"
 - "frontend: npx tsc --noEmit (passed)"
---

## Prompt

MODULE: Projects + Payments

OBJECTIVE:
Update the advance payment business rule from "advance >= 50%" to a configurable range of 30%–50%.

NEW BUSINESS RULE:
Advance Payment:
- Minimum = 30% of total project amount
- Maximum = 50% of total project amount
- Required before project activation
Validation: 30% <= advance_percentage <= 50%

TASKS: audit current impl; backend changes (validation, schemas/models, service logic, API messages); frontend changes (create/edit forms, payment screens, dashboards, helper text); data model review (advance_percentage, advance_amount); validation (29% fail, 30/40/50 pass, 51% fail); documentation.

SUCCESS CRITERIA: backend and frontend identical rules; advance only 30–50%; existing calcs correct; company reserve 30%; developer pool 70%; no conflicting validation.

OUTPUT: modified files; validation rules updated; locations where old >=50% removed; confirmation FE/BE aligned.

## Response snapshot

Audited the >=50% rule — it is code-only (no spec/FR references the advance).
Affected: projects/service.py (AdvancePaymentRequiredError + the 0.50 gate),
test_advance_payment.py, test_projects_update.py comments. Frontend advance form
was already updated to 30–50% in PHR 018.

Two design decisions raised to user (AskUserQuestion):
1. Gate semantics → **Min 30% only at the gate** (no upper cap on backend).
   The activation gate checks `paid_total` (sum of PAID payments); a hard upper
   cap would mean a client paying 60%/100% up front could never activate. The
   30–50% RANGE (incl. "51% → fail") is enforced at advance-invoice generation
   on the frontend form; the backend only enforces the 30% floor.
2. Data model → **Keep derived (no migration)**. advance_amount = sum of paid
   payments; advance_percentage = advance_amount / total. No new columns on
   Project; avoids a second source of truth.

Changes:
- service.py: added `_ADVANCE_MIN_PCT = Decimal("0.30")`; gate now
  `required_advance = total * _ADVANCE_MIN_PCT`; error text "30% advance payment
  required..."; docstring updated. Removed the `Decimal("0.50")` literal.
- test_advance_payment.py: rewrote main test to the 30% floor ($300 of $1000);
  added test_advance_below_30_percent_fails (29% → 422) and
  test_advance_above_50_percent_still_activates (60% paid → 200, proving no upper
  cap at the gate).
- test_projects_update.py: updated two stale "50% advance" comments (those tests
  pay 50% of 10000 = 5000, still clears the 30% floor — unchanged behaviour).
- lib/payments.ts: updated the divergence note — backend now enforces the
  matching 30% floor; frontend form still enforces the 30–50% window.

Verification: targeted suites 15 passed; frontend tsc clean. A broader
payment/project run showed 10 failures (payment counts, progress means) — I
stashed my changes and reproduced them on the clean base, confirming they are
PRE-EXISTING and unrelated to this change.

## Outcome

- ✅ Impact: Backend activation gate aligned to the 30% advance floor; frontend
  form enforces the full 30–50% range. FE and BE now consistent (floor matches;
  the upper bound is a frontend form concern by design).
- 🧪 Tests: advance + projects-update suites green (15); frontend tsc clean.
- 📁 Files: 3 backend, 1 frontend doc-comment.
- 🔁 Next prompts: investigate the 10 pre-existing failures (test isolation /
  seeding leakage in payments_read, projects_progress, developer_me).
- 🧠 Reflection: "51% → fail" only makes sense at the generation form, not the
  cumulative-paid activation gate — confirming with the user prevented a rule
  that would permanently block over-paying clients from activating.

## Evaluation notes (flywheel)

- Failure modes observed: ambiguous "advance_percentage/advance_amount fields"
  (derived vs stored) and gate-vs-form semantics for the upper bound.
- Graders run and results (PASS/FAIL): targeted pytest PASS; tsc PASS;
  pre-existing unrelated failures isolated via stash-and-rerun.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): fix the pre-existing test-isolation
  failures separately so the full suite is green.
