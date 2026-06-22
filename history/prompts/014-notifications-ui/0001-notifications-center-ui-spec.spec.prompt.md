---
id: 0001
title: Notifications Center UI Spec
stage: spec
date: 2026-06-19
surface: agent
model: claude-sonnet-4-6
feature: 014-notifications-ui
branch: 014-notifications-ui
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: ["notifications", "frontend", "spec", "ui"]
links:
  spec: specs/014-notifications-ui/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/014-notifications-ui/spec.md
  - specs/014-notifications-ui/checklists/requirements.md
tests:
  - none (specification phase)
---

## Prompt

Build notifications center UI.

Features:
- Notification dropdown
- Notifications page
- Read/unread states
- Real-time ready structure

## Response snapshot

Created branch `014-notifications-ui` (next number after existing `013-analytics-dashboard`; distinct from the existing `008-notifications` backend slice). Wrote `spec.md` for the consumer-facing notifications center frontend, grounded in the already-shipped `008-notifications` wire contract (`GET /notifications` envelope `{ items, unread_count, total, limit, offset }`, `PATCH /notifications/{id}/read`, closed `type` enum) and the `009-auth-ui` foundation.

Four prioritized, independently-testable user stories:
- US1 (P1): Header bell + unread badge + recent-notifications dropdown.
- US2 (P1): Full `/notifications` page with `limit`/`offset` paging.
- US3 (P1): Mark single read + client-composed "mark all as read", optimistic with rollback.
- US4 (P2): Real-time-*ready* data layer — single shared query backing badge/dropdown/page, poll + focus-refetch, one documented invalidation entry point for a future push channel.

22 functional requirements (FR-001–FR-022), 9 measurable success criteria, edge cases, assumptions, and explicit out-of-scope (admin broadcast/scan UI, real server-push transport, backend mark-all endpoint). Generated `checklists/requirements.md` and validated — all items pass, zero [NEEDS CLARIFICATION] markers (resolved via existing backend contract + prior dashboard conventions).

## Outcome

- ✅ Impact: Planning-ready spec for the notifications center frontend; no backend changes.
- 🧪 Tests: N/A (spec phase); test strategy captured in Success Criteria and per-story Independent Tests.
- 📁 Files: spec.md, checklists/requirements.md.
- 🔁 Next prompts: `/sp.clarify` (optional) then `/sp.plan`.
- 🧠 Reflection: Disambiguated UI feature from the existing `008-notifications` backend by branching as `014-notifications-ui`; pinned the frontend to the existing wire contract to avoid inventing endpoints.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell create-new-feature script split the multiline description into stray positional args (branch + spec template still created correctly); spec body written directly via Write.
- Graders run and results (PASS/FAIL): Requirements checklist — PASS (all items).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): pass multiline feature descriptions to the PS script as a single quoted arg or via a temp file to avoid positional-binding errors.
