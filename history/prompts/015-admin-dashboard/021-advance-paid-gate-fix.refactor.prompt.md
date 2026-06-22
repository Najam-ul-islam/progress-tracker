---
id: 021
title: Fix Advance Not Counting Toward Activation
stage: refactor
date: 2026-06-21
surface: agent
model: claude-sonnet-4-6[1m]
feature: 015-admin-dashboard
branch: 015-admin-dashboard
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: ["payments", "projects", "frontend", "bugfix", "activation-gate"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/modules/payments/components/GeneratePaymentDialog.tsx
tests:
 - "frontend: npx tsc --noEmit (passed)"
---

## Prompt

Activation blocked: collect at least a 30% advance payment first (use "Collect Advance" below). [PATCH /projects/4 -> 422]. When I click Collect Advance the small form appears, I select 30% then click generate payment, after that nothing happened, no notification of advance collection appears, and when I click Activate Project again it still requires to collect advance.

## Response snapshot

Root cause (backend contract): the activation gate uses get_paid_total
(payments/service.py:363) which sums ONLY payments with status == "paid". The
advance dialog submitted mark_as_paid: false, so "Collect Advance" created a
PENDING payment that never counted toward the 30% gate — activation stayed
blocked even though the advance was recorded. "Nothing happened" = the dialog
closes silently on success (no toast system exists in the app) and the pending
payment didn't move the gate.

User decision (AskUserQuestion): **Auto-mark advance as paid.** A collected
advance is money the client has paid, so it should count immediately.

Fix (GeneratePaymentDialog.tsx, advance mode = projectStatus "pending"):
- onSubmit forces markAsPaid: true when enforceAdvanceWindow is set.
- Replaced the "Mark as Paid" checkbox with a note in advance mode: "This advance
  is recorded as paid and will count toward the 30% required to activate."
- Submit button reads "Collect Advance" in advance mode.
- onSuccess now also invalidates the project progress + remaining-balance queries
  so the Financial Setup card and dialog refresh immediately.

Verified the axios client surfaces err.response.data.detail, so a 422
(e.g. ShareSumDrift when no modules exist) WOULD show in the dialog — confirming
the silent path was the pending-vs-paid mismatch, not a swallowed error.

## Outcome

- ✅ Impact: Collecting a 30–50% advance now records it as paid; it counts toward
  the activation gate and Activate Project unlocks immediately afterward.
- 🧪 Tests: frontend tsc clean.
- 📁 Files: 1 frontend file.
- 🔁 Next prompts: any advance created BEFORE this fix is sitting as a pending
  payment — mark it paid on the Payments page (or it under-counts the gate). A
  toast/confirmation system would remove the "nothing happened" perception.
- 🧠 Reflection: the gate's paid-only semantics (correct by design) were silently
  at odds with the dialog's default-pending behaviour; aligning the advance path
  to mark-paid closes the loop without weakening the gate.

## Evaluation notes (flywheel)

- Failure modes observed: pending-vs-paid mismatch between the advance dialog and
  the activation gate; no user feedback on silent dialog-close success.
- Graders run and results (PASS/FAIL): tsc PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): add a lightweight toast on payment
  success so the action is visibly confirmed.
