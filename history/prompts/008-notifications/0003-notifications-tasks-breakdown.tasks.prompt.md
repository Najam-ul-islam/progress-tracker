---
id: 0003
title: Notifications tasks breakdown
stage: tasks
date: 2026-05-09
surface: agent
model: claude-sonnet-4-6
feature: 008-notifications
branch: 007-reporting
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: [notifications, tasks, breakdown, dependencies, mvp]
links:
  spec: specs/008-notifications/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/008-notifications/tasks.md
tests:
  - (planned in tasks: contract tests for feed, mark-read, broadcast, producer hooks, deadline scan, audit-imports pytest)
---

## Prompt

/sp.tasks

MODULE: Notifications

TASKS:

1. Create Notification model

2. Create schemas:
- NotificationRead
- NotificationCreate

3. Repository:
- create_notification
- get_user_notifications
- mark_as_read

4. Service:
- send_notification
- list_notifications
- mark_notification_read

5. Routes:
- GET /notifications
- PATCH /notifications/{id}/read
- POST /notifications/send

6. Register routes

7. Validate APIs

SUCCESS:
- notifications sent/read successfully

## Response snapshot

Generated `specs/008-notifications/tasks.md` — **46 tasks across 7 phases**, dependency-ordered and parallel-marked.

**Phase 1 — Setup (T001–T005)**
- T001 `uv sync` baseline; T002 module skeleton (`backend/app/modules/notifications/{__init__,model,schema,repository,service,routes,dependencies}.py`); T003 `audit_notifications_imports.sh` blocking script; T004 verify `MODULE_REGISTRY` extension point; T005 conftest model import.

**Phase 2 — Foundational (T006–T011)** — blocking for all stories
- T006 `Notification` SQLModel; T007 alembic revision `20260510_create_notifications_table` with partial unique on `(user_id, dedup_key)`; T008 typed exceptions (`InvalidNotificationType`, `InvalidNotificationContent`, `RecipientNotFound`, `RecipientInactive`); T009 Pydantic v2 schemas; T010 helpers; T011 settings (`NOTIFICATIONS_SMTP_ENABLED`, SMTP config).

**Phase 3 — US1 Feed + Mark-Read (T012–T019)** [P1, MVP]
- Repository (`list_for_user`, `get_for_user`, `mark_read`), service, routes (`GET /notifications`, `PATCH /notifications/{id}/read`), 404 cross-user contract test.
- Independent test: developer's own feed reads + mark-read idempotency + cross-user 404.

**Phase 4 — US2 Producers + Deadline Scan (T020–T028)** [P1]
- `publish()` (caller's session, no commit/rollback); `scan_deadlines()` with `dedup_key=f"deadline:{project_id}:{date}"`; producer hooks in `projects.service` (assignment) and `payments.service` (payment + payment_paid); `POST /notifications/scan-deadlines` route.

**Phase 5 — US3 Admin Broadcast (T029–T034)** [P2]
- `_resolve_recipients` (exactly-one-of `{all, role, user_ids}`); `bulk_insert_notifications` (single-roundtrip SQL); `broadcast()`; `POST /notifications/send` route; all-or-nothing 422 on invalid `user_ids`.

**Phase 6 — US4 Email Channel (T035–T040)** [P3]
- `_send_email_async` via FastAPI `BackgroundTasks`; opt-in `email_channel: true` for broadcast; SMTP failures logged, never raised; gated by `NOTIFICATIONS_SMTP_ENABLED`.

**Phase 7 — Polish (T041–T046)**
- Audit pytest enforcing import allow-list; smoke test against quickstart.md; alembic up/down round-trip; full sweep ≥288 tests pass.

**Parallel opportunities**
- T002 sub-files (model/schema/repository/service/routes) — different files, no shared state.
- T012–T014 (repository functions) — same file, must serialize.
- T020 producer hooks (projects + payments) — different files, can parallelize after T020 publish() lands.

**MVP scope**: US1 (T001–T019) + US2 (T020–T028). Broadcast and email channel can land later without blocking the feed.

**Dependency graph**:
- Setup → Foundational → US1 → (US2 ∥ US3) → US4 → Polish.
- US2/US3/US4 each depend on T020 `publish()` for emission semantics.

## Outcome

- ✅ Impact: full execution-ready task list; ready for `/sp.implement`.
- 🧪 Tests: 6 test files planned (contract, repository, service, producer, scan, audit-imports).
- 📁 Files: `specs/008-notifications/tasks.md` (46 tasks).
- 🔁 Next prompts: `/sp.analyze` for cross-artefact consistency, then `/sp.implement` to execute.
- 🧠 Reflection: Splitting US1 (consumer) from US2 (producer) by phase — instead of by entity — meant the MVP feed works even before any producer hook is wired in. That's the right cut: it lets us ship a feed with manual broadcast first, then accrete producers without re-architecting.

## Evaluation notes (flywheel)

- Failure modes observed: empty AVAILABLE_DOCS from `check-prerequisites.ps1` until plan.md was finalised; resolved by ensuring all Phase 0/1 artefacts existed before generating tasks.
- Graders run and results (PASS/FAIL): checklist format PASS (all 46 tasks have `- [ ] T###`, `[P]?`, `[USn]?`, file paths); story-independence PASS (each US has its own test).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): n/a — proceed to `/sp.implement` when user is ready.
