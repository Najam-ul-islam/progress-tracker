---
id: 018
title: Payments Frontend Calculation Review
stage: refactor
date: 2026-06-21
surface: agent
model: claude-sonnet-4-6[1m]
feature: 015-admin-dashboard
branch: 015-admin-dashboard
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: ["payments", "frontend", "validation", "business-rules"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/lib/payments.ts
 - frontend/src/modules/payments/schemas/payment-form.schema.ts
 - frontend/src/modules/payments/components/GeneratePaymentDialog.tsx
 - frontend/src/modules/payments/pages/PaymentDetailsPage.tsx
 - frontend/src/modules/projects/pages/ProjectDetailsPage.tsx
tests:
 - "frontend: npx tsc --noEmit (passed)"
---

## Prompt

MODULE: Projects + Payments (Frontend Review)

OBJECTIVE:
Review and correct the frontend payment calculation and display logic according to the business rules below.

---

BUSINESS RULES:

Project Amount = 100%

Client Advance Payment:
- Must be between 30% and 50% of total project amount
- Required before project starts

Revenue Distribution:
- Company Reserve = 30%
- Developers Share = 70%

Developer Distribution:
- If one developer → receives 100% of developer share (70%)
- If multiple developers → split from the 70% pool according to assigned percentages

---

TASKS:

1. Audit existing frontend calculations
2. Verify advance payment validation (30%-50%)
3. Verify company reserve calculation (30%)
4. Verify developer pool calculation (70%)
5. Verify developer earnings breakdown
6. Verify dashboard/payment summary cards
7. Verify project creation/edit forms
8. Correct labels, tooltips, and UI text if misleading
9. Ensure frontend calculations match backend business rules
10. Remove duplicate or conflicting calculation logic

---

UI REQUIREMENTS:

Display:
- Total Project Amount
- Advance Amount
- Remaining Amount
- Company Reserve (30%)
- Developer Pool (70%)
- Individual Developer Earnings

---

SUCCESS CRITERIA:

- Advance validation enforced (30%-50%)
- Company share always 30%
- Developer pool always 70%
- Multi-developer distribution accurate
- Frontend matches backend calculations exactly
- No conflicting payment logic remains

## Response snapshot

Audited backend (source of truth) and frontend. Key finding: the frontend
displays backend-computed values (company_amount, developer_amount, per-developer
amount) and does NOT re-derive the 30/70 split — so there was no duplicate/
conflicting split math to remove. Backend split confirmed: company 30%, developer
70%, module shares sum to 70 (not 100), per-dev slice = pool * share/70.

Conflict surfaced to user: business rule says advance must be 30%–50%, but the
backend activation gate (projects/service.py) requires advance >= 50% with no
upper bound. User chose: enforce 30%–50% on the frontend and flag the backend
divergence (a 30–49% advance passes the form but fails backend activation).

Changes:
- NEW frontend/src/lib/payments.ts — canonical constants (COMPANY_RESERVE_PCT 0.30,
  DEVELOPER_POOL_PCT 0.70, ADVANCE_MIN_PCT 0.30, ADVANCE_MAX_PCT 0.50) + helpers.
- payment-form.schema.ts — makeAdvancePaymentSchema(total) enforces the 30–50%
  window contextually.
- GeneratePaymentDialog.tsx — accepts projectStatus; when pending, enforces the
  advance window, shows range hint + "Set 30%/Set 50%" quick buttons, defaults to
  50% max; replaced hardcoded `* 0.5`.
- ProjectDetailsPage.tsx — Financial Setup card now shows Total Project Amount,
  Company Reserve (30%), Developer Pool (70%); advance note updated to 30%–50%
  with computed range; passes projectStatus to dialog.
- PaymentDetailsPage.tsx — relabelled "Company Share"→"Company Reserve (30%)",
  "Developer Pool"→"Developer Pool (70%)".

## Outcome

- ✅ Impact: Frontend advance validation now enforces the 30%–50% product rule;
  revenue-split labels/values made explicit and consistent; magic numbers
  centralized in lib/payments.ts.
- 🧪 Tests: `npx tsc --noEmit` passes; no existing tests referenced the changed
  components.
- 📁 Files: 1 new, 4 modified (all frontend).
- 🔁 Next prompts: Align backend activation gate to the 30%–50% window (currently
  >=50%); add component tests for the advance-window validator.
- 🧠 Reflection: The stated "match backend exactly" and "enforce 30%–50%" were in
  direct conflict; pausing to ask rather than guessing prevented blocking valid
  activations.

## Evaluation notes (flywheel)

- Failure modes observed: business-rule/backend divergence on advance bounds.
- Graders run and results (PASS/FAIL): tsc PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): backend AdvancePayment gate to accept
  30%–50% range to fully reconcile frontend and backend.
