---
id: 0002
title: Notifications implementation plan
stage: plan
date: 2026-05-09
surface: agent
model: claude-sonnet-4-6
feature: 008-notifications
branch: 007-reporting
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: [notifications, plan, architecture, inverted-topology, email-channel]
links:
  spec: specs/008-notifications/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/008-notifications/plan.md
  - specs/008-notifications/research.md
  - specs/008-notifications/data-model.md
  - specs/008-notifications/contracts/notifications.openapi.yaml
  - specs/008-notifications/quickstart.md
tests:
  - (none yet — Phase 0/1 design only; tests planned for /sp.tasks → /sp.implement)
---

## Prompt

/sp.plan

MODULE: Notifications

PHASES:
1. Model
2. Schemas
3. Repository
4. Service
5. Routes
6. Integration
7. Validation

FEATURES:
- send notification
- mark as read
- list notifications

RULES:
- service-layer logic only
- RBAC enforced

## Response snapshot

Generated Phase 0 + Phase 1 artefacts for the notifications module:

**research.md — 10 decisions**
1. Inverted dependency topology — `notifications` imports only `users` + `auth`; producers (`projects`, `payments`) call `notifications.service.publish`. ADR candidate.
2. Mark-read is irreversible (first-read wins; `read_at` immutable).
3. Cross-user PATCH/read returns **404 not 403** (FR-005, privacy).
4. Email channel inside notifications module, gated by `NOTIFICATIONS_SMTP_ENABLED`.
5. Deadline-scan endpoint co-located in notifications.
6. Direct writes by upstream modules forbidden (audit-script enforced).
7. Broadcast is all-or-nothing (FR-019).
8. Selective `dedup_key` (NULL except scan rows; partial unique).
9. Pagination defaults: `limit=50`, max=200, `>200 → 422`.
10. Pre-rendered message strings, not templates.

**data-model.md — `notifications` table**
- Columns: `id`, `user_id` FK, `title` VARCHAR(120), `message` VARCHAR(2000), `type` VARCHAR(32) (closed enum), `is_read`, `read_at`, `created_at`, `dedup_key` VARCHAR(128) nullable.
- Indexes: `ix_notifications_user_created` on `(user_id, created_at DESC)`; partial unique `uq_notifications_user_dedup` on `(user_id, dedup_key) WHERE dedup_key IS NOT NULL` (PG) / plain unique on SQLite.
- CHECK constraints on title/message length.
- DTOs (Pydantic v2, `extra="forbid"`, `from_attributes=True`): `NotificationRead`, `NotificationFeed`, `BroadcastRecipients`, `BroadcastRequest`, `BroadcastResult`, `MarkReadResponse`, `ScanResult`.
- Internal API: `publish(session, *, recipient_id, title, message, type, dedup_key=None, email_channel=False) -> Notification` — uses caller's session, never commits/rolls back.

**contracts/notifications.openapi.yaml — 4 endpoints**
- `GET /notifications` (caller's feed, paginated)
- `PATCH /notifications/{notification_id}/read` (idempotent; 404 on cross-user)
- `POST /notifications/send` (admin broadcast; recipients = exactly one of `{all, role, user_ids}`)
- `POST /notifications/scan-deadlines` (admin; idempotent per calendar day via `dedup_key`)

**quickstart.md — 10-step curl walkthrough**
- Sign-in → empty feed → admin broadcast → developer feed → mark-read → cross-user 404 → producer hook (assignment) → deadline scan → manager 403 → 422 validation table → email channel.

**Constitution Check: PASS**
- Six-file modular layout preserved.
- 401→403→404→422 guard ordering enforced (with 404-conflation for cross-user).
- No business logic in routes (service-layer only).
- RBAC at service layer.
- Async-ready (FastAPI `BackgroundTasks` for email).

**Architectural decision detected**: notifications-import-topology — surface ADR suggestion at PR time:
> 📋 Architectural decision detected: notifications-import-topology — Document reasoning and tradeoffs? Run `/sp.adr notifications-import-topology`

## Outcome

- ✅ Impact: Phase 0/1 design artefacts complete; module is ready for `/sp.tasks` → `/sp.implement`.
- 🧪 Tests: deferred to tasks phase (5 test files planned: feed, mark-read, broadcast, producer, scan).
- 📁 Files: 5 design artefacts under `specs/008-notifications/`.
- 🔁 Next prompts: `/sp.tasks` to break the plan into executable tasks.
- 🧠 Reflection: Inverted topology is the load-bearing decision — it makes notifications a leaf and lets producers own their display vocabulary forever. Without it, every payments rename would force a notifications change.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell positional-arg quoting on `setup-plan.ps1` with multi-line args; resolved by writing artefacts manually after the script created the directory.
- Graders run and results (PASS/FAIL): Constitution Check PASS; Modularity gate PASS; Privacy gate PASS (cross-user 404).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): n/a — proceed to `/sp.tasks`.
