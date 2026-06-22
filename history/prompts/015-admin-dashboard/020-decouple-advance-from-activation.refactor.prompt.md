---
id: 020
title: Decouple Advance From Activation
stage: refactor
date: 2026-06-21
surface: agent
model: claude-sonnet-4-6[1m]
feature: 015-admin-dashboard
branch: 015-admin-dashboard
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: ["payments", "projects", "frontend", "ux", "business-flow"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/modules/projects/pages/ProjectDetailsPage.tsx
tests:
 - "frontend: npx tsc --noEmit (passed)"
---

## Prompt

MODULE: Projects + Payments (Frontend + Backend Alignment)

OBJECTIVE: Fix the incorrect flow where "Advance Collection" is triggered from the "Activate Project" action. Move advance handling to project creation.

CURRENT ISSUE: advance payment handled in the Activate button; mixes financial collection with status transition; causes confusion.

CORRECT FLOW: (1) project creation collects 30–50% advance; (2) activation is only a status change allowed when total_paid >= 30%, no payment creation.

TASKS — Frontend: move advance input to Create Project, remove advance logic from Activate, show advance summary, update labels. Backend: ensure creation supports advance context, remove payment creation from activation, keep activation pure. Payments: advance = initial Payment linked to creation; activation only checks totals.

VALIDATION: creation allows 30–50% advance; activation must NOT create/modify payments; activation only checks total_paid >= 30%.

SUCCESS: advance handled only at creation; activation status-only; no payment logic in activation; UI separates "Create + Collect Advance" vs "Activate (status only)".

## Response snapshot

Audit findings:
- Backend activation (projects/service.py update_project) is ALREADY a pure
  status transition — it only checks get_paid_total >= 30%, never creates/modifies
  a Payment. The only auto-billing (_maybe_autocomplete_project) fires on
  COMPLETION, not activation. So no backend change was needed.
- The mixing lived only on the frontend: ProjectDetailsPage activateMutation
  onError caught "advance payment required" and auto-opened GeneratePaymentDialog.

Structural blocker surfaced to user: generating the advance AT creation is
impossible as built — generate_payment_distribution requires active module shares
to sum to exactly 70 (ShareSumDrift) and produces per-module developer breakdown
rows, but a freshly created project has zero modules. Current order is
create → add modules (=70%) → generate advance → mark paid → activate.

User decision (AskUserQuestion): **"Just decouple, keep order."** Do not move
advance into creation; only remove the advance dialog from the Activate button and
make advance collection a clear standalone action. Keeps the existing order and
fixes the confusion without the structural model change.

Changes (frontend only, ProjectDetailsPage.tsx):
- activateMutation.onError no longer opens the payment dialog. On the
  advance-required error it shows a plain message: "Activation blocked: collect at
  least a 30% advance payment first (use Collect Advance below)." Activation is now
  purely a status transition from the UI's perspective.
- Financial Setup button relabelled to "Collect Advance" on pending projects
  (keeps "Generate Payment" otherwise).
- Helper text clarified: collect a 30–50% advance here; activation is a separate
  step unlocked once >=30% is paid.

## Outcome

- ✅ Impact: Advance collection and activation are now visually and behaviourally
  separate. Activate = status only; Collect Advance = a distinct, clearly-labelled
  action. No payment dialog is summoned from the Activate flow.
- 🧪 Tests: frontend tsc clean. (Backend untouched — already compliant.)
- 📁 Files: 1 frontend file.
- 🔁 Next prompts: if true advance-at-creation is later desired, revisit the
  "store advance %, defer payment" or "module-less advance Payment" options that
  were declined this round.
- 🧠 Reflection: the request assumed advance creation belonged in the create form,
  but the module→breakdown dependency makes that a model change; surfacing the
  blocker let the user pick the minimal decouple instead.

## Evaluation notes (flywheel)

- Failure modes observed: spec assumed a flow the data model can't support at
  creation time (no modules → no breakdown).
- Graders run and results (PASS/FAIL): tsc PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): none required; flow is decoupled.
