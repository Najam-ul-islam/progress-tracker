---
id: 0001
title: Define notifications spec
stage: spec
date: 2026-05-09
surface: agent
model: claude-sonnet-4-6
feature: 008-notifications
branch: 008-notifications
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: [notifications, spec, rbac, async, in-app, email, deadline-scan]
links:
  spec: specs/008-notifications/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/008-notifications/spec.md
  - specs/008-notifications/checklists/requirements.md
  - history/prompts/008-notifications/0001-define-notifications-spec.spec.prompt.md
tests:
  - n/a (spec stage; tests authored at /sp.tasks and exercised at /sp.implement)
---

## Prompt

/sp.specify

MODULE: Notifications

PURPOSE:
Manage system notifications for projects, assignments, payments, and deadlines.

---

FEATURES:
- in-app notifications
- email notifications
- project/module assignment alerts
- payment alerts
- deadline reminders

---

MODEL:
Notification:
- id
- user_id
- title
- message
- type
- is_read
- created_at

---

ENDPOINTS:
- GET /notifications
- PATCH /notifications/{id}/read
- POST /notifications/send

---

RBAC:
- users view own notifications
- admin full access

---

RULES:
- modular architecture
- async-ready
- no business logic in routes

## Response snapshot

**Branch `008-notifications` created. Spec drafted with 4 user stories, 27 FRs, 11 SCs, 9 edge cases, and a passing requirements checklist.**

### Branching

- Searched remote/local/specs for `*-notifications` — none. Next number: **008**.
- `create-new-feature.ps1 -Number 8 -ShortName "notifications"` checked out `008-notifications` and dropped a template `spec.md`. (PowerShell logged a positional-arg warning because the multi-line description was passed via `\n` expansion; branch and spec file were created correctly nonetheless.)

### Stories (priority + independent test)

1. **US1 (P1) — User reads their own in-app feed.** Foundational consumer surface. Tested by seeding 3+2 notifications across two users, asserting cardinality, ordering, `unread_count`, and idempotent PATCH-read.
2. **US2 (P1) — System auto-creates notifications on key events.** Producers in projects/payments emit assignment / payment / payment_paid / deadline rows transactionally. P1 alongside US1 because the feed has no value without producers.
3. **US3 (P2) — Admin manual / broadcast send.** Single endpoint with `{ all }`, `{ role }`, or `{ user_ids }` selector. Fan-out validated by row-count assertions on three fixtures.
4. **US4 (P3) — Email channel for high-importance events.** Async, best-effort, deduped per notification id. SMTP failure never raises to the API caller.

### Functional requirements (27 total)

- **FR-001 — FR-007**: 3 endpoints + RBAC + 401/403/404/422 ordering + privacy via 404-not-403.
- **FR-008 — FR-013**: producers (assignment/payment/payment_paid/deadline), single internal entry point `notifications.service.publish`, transactional binding, deadline scan idempotency.
- **FR-014 — FR-019**: schema (`id, user_id, title, message, type, is_read, read_at, created_at, dedup_key`), `unique(user_id, dedup_key)` for scan dedup, soft-deleted user exclusion, recipient-selector validation (exactly one of `{all, role, user_ids}`), all-or-nothing fan-out validation.
- **FR-020 — FR-022**: closed type enum (`assignment | payment | payment_paid | deadline | system`), title/message bounds (120 / 2000 chars), server-only timestamps.
- **FR-023 — FR-027**: zero business logic in routes; **inverted import allow-list** — notifications imports only `users` + `auth`, and upstream producers import `notifications.service.publish` (so notifications has no dependency on projects/payments); ≤2 round-trips on `GET /notifications`; async email channel; never 500 on valid auth.

### Notable design choices documented in the spec

- **404 instead of 403 for cross-user PATCH/read** — explicitly chosen to prevent existence leakage (Edge Cases section + FR-005).
- **Inverted dependency direction** — instead of notifications importing from `projects` / `payments` to fetch context, the upstream producers call `notifications.service.publish` with prerendered `title` / `message` strings. This keeps notifications a leaf module and avoids the coupling that has been a recurring theme in the reporting/payments specs.
- **Append + mark-read only** — no edit, no delete. Out of scope for v1; would compromise audit trail.
- **Dedup is selective** — auto-emitted scan rows use `(user_id, dedup_key)` uniqueness; manual broadcasts and event-driven rows leave `dedup_key NULL` and are unconstrained. Chosen so that legitimate repeat events (multiple payments) are not de-duped, but daily deadline-scans never duplicate.
- **FastAPI BackgroundTasks for the email channel** in v1 (no Celery/RQ) — promotable to a worker later. Captured in Assumptions.

### Checklist

`specs/008-notifications/checklists/requirements.md` written; all 16 items pass on first iteration. Zero `[NEEDS CLARIFICATION]` markers.

## Outcome

- ✅ Impact: feature 008 ready for `/sp.clarify` or `/sp.plan`. Spec is internally consistent with the patterns established by 005/006/007 (six-file modular layout, ≤4-RT budgets, RBAC + audit script).
- 🧪 Tests: none authored (spec stage); the spec specifies ≥30 cases at green time per SC-009.
- 📁 Files: `specs/008-notifications/spec.md`, `specs/008-notifications/checklists/requirements.md`, this PHR. Branch `008-notifications` checked out from `007-reporting`.
- 🔁 Next prompts: `/sp.plan` (translate FR-001 — FR-027 into the modular architecture, with explicit attention to the inverted import topology and email-channel boundary), or `/sp.clarify` if the user wants to challenge the 404-vs-403 leakage rule or the inverted import direction first.
- 🧠 Reflection: the inversion (FR-024) is the single biggest architectural decision in this spec — it sets the topology for every future cross-module side-effect (audit logs, webhook fan-out, metrics emission). Worth surfacing as an ADR candidate at `/sp.plan` time.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell positional-argument warning when passing a multi-line description with `\n` escapes. Side-effect-free (the script still created the branch and the empty spec); recommend passing the description via stdin or a file for cleaner arg handling next time.
- Graders run and results (PASS/FAIL): Requirements checklist → PASS (16/16). `[NEEDS CLARIFICATION]` markers → 0 (target ≤3) PASS. Spec template structural fidelity → PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): at `/sp.plan` time, consider whether the deadline-scan endpoint belongs to notifications or to a small `scheduling` module. Right now it is co-located in notifications; if more periodic scans accrete (overdue-payment chase, idle-developer warnings), a dedicated module may pay back the abstraction.
