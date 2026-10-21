---
description: "Dependency-ordered task list for feature 008-notifications"
---

# Tasks: Notifications

**Input**: Design documents in `specs/008-notifications/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/notifications.openapi.yaml, quickstart.md

**Tests**: INCLUDED. Spec mandates ≥30 cases (SC-009) and an audit pytest mirroring `audit_notifications_imports.sh`.

**Organisation**: Tasks are grouped by user story (US1–US4) so each priority slice ships independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 feed P1; US2 producers P1; US3 broadcast P2; US4 email channel P3)
- Paths are absolute under `D:\progress-tracker\` (the repo root) and use forward slashes inside the file content.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify dependency state, scaffold the module, and add the audit script. No business logic.

- [ ] T001 Verify dependency state via `cd backend && uv sync` — must report no changes (this feature adds **zero** new packages by default; SMTP transport via `aiosmtplib` is opt-in only and not added at green-stage).
- [ ] T002 [P] Create the empty six-file module skeleton at `backend/app/modules/notifications/`: `__init__.py`, `model.py`, `schema.py`, `repository.py`, `service.py`, `routes.py`, `dependencies.py` (empty stub — `auth.dependencies` is reused). Each file ≤5 lines (header comment + imports if any).
- [ ] T003 [P] Author `backend/scripts/audit_notifications_imports.sh` enforcing (a) the FR-024 allow-list inside `app/modules/notifications/` (only `users.repository`, `users.model`, `auth.dependencies`, `auth.schema` from siblings), and (b) the inverse rule that no file under `app/modules/{projects,payments,clients,reporting,users,auth}/**` writes the `notifications` table directly — i.e. no `Notification(` constructor call and no `session.add(` of a Notification outside `app/modules/notifications/`. Mirror the regex style of `backend/scripts/audit_reporting_imports.sh`. Make executable; exit 0 on pass.
- [ ] T004 Verify the line `("notifications", "/notifications"),` is present in the `MODULE_REGISTRY` tuple in `backend/app/main.py` (it was scaffolded earlier). If absent, add it after the `("reporting", "/reports")` entry. Verify the file still parses with `uv run python -c "from app.main import app"`.
- [X] T005 In `backend/tests/conftest.py`, add `from app.modules.notifications.model import Notification  # noqa: F401` next to the existing model imports so `Base.metadata.create_all` picks up the new table.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-story scaffolding — the SQLModel + alembic revision + typed exceptions + test helpers — that every user story phase needs.

- [X] T006 In `backend/app/modules/notifications/model.py`, declare `class NotificationType(str, Enum)` with members `ASSIGNMENT="assignment"`, `PAYMENT="payment"`, `PAYMENT_PAID="payment_paid"`, `DEADLINE="deadline"`, `SYSTEM="system"`. Then declare `class Notification(SQLModel, table=True)` per `data-model.md`: fields `id` (PK), `user_id` (FK `users.id`, indexed), `title` (str, ≤120), `message` (str, ≤2000), `type` (str, stored as enum value), `is_read` (bool, default False), `read_at` (datetime | None, default None), `created_at` (datetime, default `datetime.utcnow`), `dedup_key` (str | None, default None). Add `__table_args__` with the composite index `("ix_notifications_user_created", user_id, created_at.desc())` and the partial unique index `("uq_notifications_user_dedup", user_id, dedup_key, postgresql_where=text("dedup_key IS NOT NULL"), unique=True)`.
- [X] T007 Author the alembic revision `backend/alembic/versions/20260510_create_notifications_table.py`. `down_revision` references the latest existing revision (the payments table create at `20260505_create_payment_table`). `upgrade()` creates the table + composite index + partial unique index (`postgresql_where=sa.text('dedup_key IS NOT NULL')`) + the two `CHECK` constraints on `length(title)` and `length(message)`. `downgrade()` drops the indexes then the table. Use `sa.MetaData(naming_convention=...)` if the project's alembic env requires it (check the existing payments revision for the exact env shape).
- [X] T008 [P] In `backend/app/modules/notifications/service.py`, declare 4 typed exceptions: `InvalidNotificationType`, `InvalidNotificationContent`, `RecipientNotFound`, `RecipientInactive`. Each subclasses `Exception` and carries a single human-readable message. Match the exception-class style of `backend/app/modules/reporting/service.py`.
- [X] T009 [P] In `backend/app/modules/notifications/schema.py`, declare Pydantic v2 models with `extra="forbid"`, `from_attributes=True` per `data-model.md`: `NotificationRead`, `NotificationFeed`, `BroadcastRecipients`, `BroadcastRequest`, `BroadcastResult`, `MarkReadResponse`, `ScanResult`. Add a `model_validator(mode="after")` on `BroadcastRecipients` that enforces exactly-one-of `{all, role, user_ids}` (FR-018) and raises `ValueError` listing the offending fields when violated.
- [ ] T010 [P] In `backend/tests/_notifications_helpers.py`, author `seed_notifications_landscape(client, session, seed_admin, seed_manager, seed_developer, auth_header) -> dict` that builds: 1 admin, 1 manager, 3 developers, plus 5 notifications across them at mixed types (`system`, `assignment`, `payment`, `payment_paid`, `deadline`) and mixed read/unread. Returns `{"admin", "manager", "developers": [d1, d2, d3], "notifications_by_user": {d1.id: [...], d2.id: [...]}, "auth_header": admin_header}`. Use `notifications.service.publish` for every insert (NOT direct `session.add(Notification(...))`) — the helper itself must respect FR-012.
- [ ] T011 [P] In `backend/tests/_notifications_helpers.py`, add a `CapturedEmail` dataclass + a `capture_emails()` context manager that monkey-patches the module's email-channel send function to push into an in-memory list. Used by US4 tests; safe to import from US3 tests too. Returns the list on exit.

---

## Phase 3: User Story 1 — Feed read + mark-read (P1) 🎯 MVP

**Story Goal**: Authenticated user calls `GET /notifications` and sees only their own rows in `created_at` desc with unread_count + total. They can `PATCH /notifications/{id}/read` and the row flips to read; subsequent calls are idempotent. Cross-user PATCH returns 404.

**Independent Test (SC-002, SC-003)**: Seed two users with disjoint notification sets. As user A, `GET /notifications` returns A's rows only. PATCH one of A's rows → is_read flips, unread_count drops by exactly 1. PATCH again → 200, read_at unchanged. PATCH B's id as A → 404.

### Tests (red, before implementation)

- [ ] T012 [P] [US1] Author `backend/tests/test_notifications_feed.py` with at least 8 cases: empty feed (envelope shape, zero counts), seeded multi-user feed scoping (user A sees only A's rows), `created_at` desc ordering, pagination via `limit=2&offset=2`, mark-read happy path (returns 200 with `read_at`), mark-read idempotent (second call returns same `read_at`), mark-read 404 cross-user, mark-read 404 nonexistent id, `limit=500` → 422 (cap, Decision 9), unauthenticated → 401. Initially fails.

### Implementation

- [X] T013 [US1] In `backend/app/modules/notifications/repository.py`, implement `list_for_user(session, *, user_id: int, limit: int, offset: int) -> tuple[list[Notification], int, int]` returning `(items, unread_count, total)`. One SELECT for `items` (`order_by(Notification.created_at.desc()).limit(limit).offset(offset)`), one SELECT for `unread_count` (`func.count` filtered by `is_read=False`), one SELECT for `total` (`func.count` filtered by user). Combine the count queries into a single `select(func.count(...).filter_by(is_read=False).label("unread"), func.count().label("total"))` to honour FR-025 (≤2 round-trips).
- [X] T014 [US1] In `backend/app/modules/notifications/repository.py`, implement `get_for_user(session, *, notification_id: int, user_id: int) -> Notification | None` (single SELECT, returns None if not found OR not owned by user — caller-side conflation enforces FR-005).
- [X] T015 [US1] In `backend/app/modules/notifications/repository.py`, implement `mark_read(session, *, notification: Notification) -> Notification` that, when `is_read` is False, sets `is_read=True` and `read_at=datetime.utcnow()`; when already True, returns the row unchanged. **Does not commit** — the caller controls the transaction. Single UPDATE, ≤1 round-trip (FR-025).
- [X] T016 [US1] In `backend/app/modules/notifications/service.py`, implement `list_notifications_for_user(session, *, current_user, limit: int, offset: int) -> NotificationFeed`. Validates `1 <= limit <= 200` and `offset >= 0`; raises ValueError on violation (mapped to 422 in routes). Delegates to repository; assembles the `NotificationFeed` envelope.
- [X] T017 [US1] In `backend/app/modules/notifications/service.py`, implement `mark_notification_read(session, *, notification_id: int, current_user) -> MarkReadResponse`. Calls `repository.get_for_user`; if `None`, raises `NotificationNotFound` (new typed exception in T008's set; if missed, add now). Calls `repository.mark_read`; commits via the dependency-injected session pattern used elsewhere; returns `MarkReadResponse`.
- [X] T018 [US1] In `backend/app/modules/notifications/routes.py`, add the `APIRouter`. Register `GET /notifications` gated by `Depends(get_current_user)` returning `NotificationFeed`. Register `PATCH /notifications/{notification_id}/read` gated by `Depends(get_current_user)`. Map exceptions: `ValueError → 422`, `NotificationNotFound → 404`. Body of each route is a single `return service.<fn>(session=session, current_user=user, ...)` — zero business logic.
- [ ] T019 [US1] Run `cd backend && uv run pytest tests/test_notifications_feed.py -v`. All ≥8 cases must PASS. STOP and fix on any failure before continuing to US2.

**Checkpoint**: US1 complete. Feed + mark-read works in isolation. MVP achievable here for the *consumer* surface.

---

## Phase 4: User Story 2 — Auto-emit producers (P1)

**Story Goal**: When a developer is assigned to a module, when a payment is generated, when a developer-payment moves to paid, and when the deadline scan runs, a `Notification` row is created **transactionally** for the right recipient via `notifications.service.publish`. Producer hooks live in upstream modules' service layers, never in routes.

**Independent Test (SC-005)**: Trigger an assignment via the projects flow; assert a row with `type=assignment` and `user_id=developer.id` exists. Force the projects-service transaction to roll back; assert no orphan notification row was committed. Run `scan-deadlines` twice on the same fixture day; assert row count unchanged on the second call.

### Tests

- [ ] T020 [P] [US2] Author `backend/tests/test_notifications_producers.py` with at least 8 cases: assignment auto-emits (single row, correct type/user_id, includes module name in message), payment-create auto-emits one notification per developer payment recipient, payment-paid transition auto-emits `payment_paid`, deadline scan emits `deadline` for active projects within lookahead window, scan idempotent on second same-day call (`deduped > 0, emitted == 0`), publish raises `InvalidNotificationType` on bad enum (422), publish raises `RecipientNotFound` on bad user id (422), induced rollback on the originating projects/payments transaction → no notification row persists (transactional binding test).

### Implementation

- [ ] T021 [US2] In `backend/app/modules/notifications/repository.py`, implement `insert_notification(session, *, user_id, title, message, type_, dedup_key=None) -> Notification` — single `session.add` + `session.flush` (NOT `commit` — caller controls the transaction). On `IntegrityError` from the partial unique index (dedup collision), catch, rollback the savepoint via `session.rollback()` ONLY if a savepoint exists, and re-raise as a typed `DedupCollision` exception. (For SQLite tests where there is no savepoint, the caller wraps in `session.begin_nested()` so the rollback is local.)
- [X] T022 [US2] In `backend/app/modules/notifications/service.py`, implement the public `publish(session, *, recipient_id, title, message, type, dedup_key=None, email_channel=False) -> Notification`. Validates `type` against the enum (raises `InvalidNotificationType`); validates `title` length 1..120 and `message` length 1..2000 stripped (raises `InvalidNotificationContent`); fetches the recipient via `users.repository.get_user_by_id` (raises `RecipientNotFound`); checks `recipient.is_active` (raises `RecipientInactive`); calls `repository.insert_notification`; if `email_channel=True` AND `settings.NOTIFICATIONS_SMTP_ENABLED` is True, enqueues an email send via the channel module (US4) — but for now leave a `TODO: enqueue email` comment with no-op fallback so the function works pre-US4. Returns the persisted `Notification`.
- [ ] T023 [US2] In `backend/app/modules/notifications/service.py`, implement `scan_deadlines(session, *, lookahead_days: int = 3) -> ScanResult`. Walks active projects with `end_date <= today + lookahead_days` AND `is_active=True`. For each project, resolves recipients = (admin users + manager users, both active); for each `(project, recipient)` pair, calls `publish` with `dedup_key=f"deadline:{project.id}:{today.isoformat()}"`, `type=DEADLINE`, title and message that name the project + days remaining. Catches `DedupCollision` per row → increment `deduped`; otherwise increment `emitted`. Returns `ScanResult`.
- [ ] T024 [US2] In `backend/app/modules/notifications/routes.py`, register `POST /notifications/scan-deadlines` gated by `Depends(require_admin)`. Body: `{lookahead_days: int = 3}` (Pydantic schema in `schema.py` if not added in T009 — add now). Returns `ScanResult`. Single line: `return service.scan_deadlines(session=session, lookahead_days=body.lookahead_days)`.
- [ ] T025 [US2] In `backend/app/modules/projects/service.py`, find the developer-assignment function (the one that creates a `ProjectModule.assigned_developer_id` link). Add **immediately after the assignment is staged** (and before commit) a call to `notifications.service.publish(session, recipient_id=developer.id, title=f"You have been assigned to {module.name}", message=f"You are now assigned to module \"{module.name}\" on project \"{project.name}\".", type=NotificationType.ASSIGNMENT)`. Import only `notifications.service.publish` and `notifications.model.NotificationType`. Do not catch the publish exceptions — they are bugs and must surface as 500 in tests until fixed.
- [ ] T026 [US2] In `backend/app/modules/payments/service.py`, find the payment-generation function (the one that creates `Payment` + `DeveloperPayment` rows). For each `DeveloperPayment` recipient, add a `notifications.service.publish` call with `type=NotificationType.PAYMENT`, title naming the project, message including the amount as a decimal string. Same import constraint as T025.
- [ ] T027 [US2] In `backend/app/modules/payments/service.py`, find the function that transitions a developer payment from `pending` to `paid`. Add a `notifications.service.publish` call with `type=NotificationType.PAYMENT_PAID`, message including the paid amount. Same constraint.
- [ ] T028 [US2] Run `cd backend && uv run pytest tests/test_notifications_producers.py -v`. All ≥8 cases must PASS. STOP and fix on any failure before continuing to US3.

**Checkpoint**: US2 complete. The system now auto-emits feed entries on the four canonical events. Combined with US1, the MVP is fully shippable.

---

## Phase 5: User Story 3 — Admin broadcast (P2)

**Story Goal**: Admin posts to `POST /notifications/send` with one of `{ all, role, user_ids }`, a title, and a message. The system fans out into one notification per resolved recipient, all-or-nothing on `user_ids` validation.

**Independent Test (SC-004)**: Seed 3 developers, 2 managers, 1 admin. Broadcast with `recipients={role: "developer"}` → exactly 3 rows. Broadcast with `recipients={user_ids: [4, 7]}` → exactly 2 rows. Broadcast with one bad id → 422, zero rows created.

### Tests

- [ ] T029 [P] [US3] Author `backend/tests/test_notifications_broadcast.py` with at least 7 cases: role selector exact fan-out (3 developers), all selector counts active users only (soft-deleted excluded), user_ids selector exact rows, manager forbidden (403), developer forbidden (403), zero selectors → 422, two selectors → 422, one bad user_id in user_ids → 422 with zero rows created (verify via post-failure SELECT count == 0).

### Implementation

- [X] T030 [US3] In `backend/app/modules/notifications/service.py`, implement `_resolve_recipients(session, *, recipients: BroadcastRecipients) -> list[int]`. Branches: `all` → query `users.repository` for all active users' ids; `role` → query for active users with that role; `user_ids` → fetch each id via `users.repository.get_user_by_id`, collect missing or inactive ids; if any → raise `InvalidRecipientIds(invalid_ids=[...])`. Returns the resolved list (deduped).
- [X] T031 [US3] In `backend/app/modules/notifications/repository.py`, implement `bulk_insert_notifications(session, *, rows: list[dict]) -> int` using SQLAlchemy's `insert(Notification.__table__).values(rows)`. Single round-trip. Returns rowcount.
- [X] T032 [US3] In `backend/app/modules/notifications/service.py`, implement `broadcast(session, *, request: BroadcastRequest, current_user) -> BroadcastResult`. Verifies `current_user.role == "admin"` (defensive — route also gates). Calls `_resolve_recipients`. Builds row dicts with the supplied title/message/type, `dedup_key=None`, `created_at=now`. Calls `bulk_insert_notifications`. If `request.email_channel=True` and SMTP enabled, enqueue one email task per recipient (US4 hook; TODO/no-op until US4 lands). Returns `BroadcastResult(created=rowcount, type=request.type or "system", recipients_resolved=len(resolved))`.
- [X] T033 [US3] In `backend/app/modules/notifications/routes.py`, register `POST /notifications/send` gated by `Depends(require_admin)`. Map exceptions: `InvalidRecipientIds → 422` (with the invalid_ids list in the detail body), `ValueError → 422`. Single-line body: `return service.broadcast(session=session, request=body, current_user=user)`.
- [ ] T034 [US3] Run `cd backend && uv run pytest tests/test_notifications_broadcast.py -v`. All ≥7 cases must PASS.

**Checkpoint**: US3 complete. Admin can now ship arbitrary messages.

---

## Phase 6: User Story 4 — Email channel (P3)

**Story Goal**: Auto-emitted `assignment` / `payment_paid` / `deadline` notifications, plus broadcasts with `email_channel=true`, are also dispatched as emails via a FastAPI `BackgroundTasks` queue. SMTP transport is gated behind `NOTIFICATIONS_SMTP_ENABLED`. Failures never raise to the caller.

**Independent Test (SC-011)**: Configure the test fixture with the in-memory `capture_emails()` collector. Trigger an assignment → exactly one captured email to the developer's address. Force the SMTP function to raise → in-app row still appears, no exception propagates. Broadcast with `email_channel=true` → emails dispatched; without → none.

### Tests

- [ ] T035 [P] [US4] Author `backend/tests/test_notifications_email_channel.py` with at least 4 cases: enabled-channel happy path (assignment → 1 email captured at the developer's email address with subject derived from title), SMTP transport error swallowed (in-app row created, captured collector empty, error logged), broadcast opt-in flag (no email_channel → 0 emails; email_channel=true → N emails matching recipients), dedup-on-replay (running scan-deadlines twice → emails sent only on the first call, because dedup'd rows do not enqueue).

### Implementation

- [ ] T036 [US4] In `backend/app/modules/notifications/service.py` (or a new `email_channel.py` co-located in the module), implement `_send_email_async(message: EmailMessage) -> None` that, when `settings.NOTIFICATIONS_SMTP_ENABLED` is True, dispatches via `aiosmtplib.send` (lazy import — only imported if the flag is True so a missing dep doesn't break startup). On any exception, log at WARNING and return None. **Never raises.**
- [ ] T037 [US4] In `backend/app/modules/notifications/service.py`, augment `publish` to actually enqueue the email when `email_channel=True` and the type is in the high-importance set (`ASSIGNMENT`, `PAYMENT_PAID`, `DEADLINE`). Use FastAPI `BackgroundTasks` — accept an optional `background_tasks` kwarg in `publish`; when provided, `background_tasks.add_task(_send_email_async, build_email_message(notification, user))`; when None, fall back to a fire-and-forget `asyncio.create_task` so the function still works outside HTTP context (e.g., from upstream service tests). Document the contract in a one-line docstring.
- [ ] T038 [US4] Update the producer call sites in `projects/service.py` and `payments/service.py` (T025–T027) to pass the request's `BackgroundTasks` through. The route signature gains `background_tasks: BackgroundTasks`; the service signatures gain `background_tasks: BackgroundTasks | None = None`. For paths where no HTTP request is in scope (deadline scan from a future scheduler), `None` is acceptable and triggers the asyncio fallback.
- [ ] T039 [US4] In `backend/app/core/settings.py` (or wherever `pydantic-settings` is wired up), add `NOTIFICATIONS_SMTP_ENABLED: bool = False`, `NOTIFICATIONS_SMTP_HOST: str | None = None`, `NOTIFICATIONS_SMTP_PORT: int = 587`, `NOTIFICATIONS_SMTP_USERNAME: str | None = None`, `NOTIFICATIONS_SMTP_PASSWORD: str | None = None`, `NOTIFICATIONS_FROM_EMAIL: str = "noreply@progresstracker.local"`. Document each in the existing settings file's style.
- [ ] T040 [US4] Run `cd backend && uv run pytest tests/test_notifications_email_channel.py -v`. All ≥4 cases must PASS. The default test environment leaves SMTP disabled; the channel runs against the `capture_emails()` monkey-patch.

**Checkpoint**: US4 complete. The email channel is wired but inert until ops sets the env flag.

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Final audits, smoke checks, and the full sweep.

- [ ] T041 [P] Author `backend/tests/test_notifications_audit.py` with at least 3 cases that mirror the shell audit script: (a) walk every `.py` under `app/modules/notifications/` and assert no `from app.modules.<projects|payments|clients|reporting>` imports exist (FR-024 allow-list); (b) walk every `.py` under `app/modules/{projects,payments,clients,reporting,users,auth}/` and assert no `Notification(` constructor call and no `session.add(...Notification...)` exists outside `app/modules/notifications/`; (c) walk `app/modules/notifications/**` and assert no `session.delete(` and no `session.merge(` (append-only invariant; `session.commit(` is allowed in service for self-contained ops like mark-read).
- [ ] T042 Run `bash backend/scripts/audit_notifications_imports.sh` from the repo root. Must exit 0.
- [ ] T043 Smoke check: `cd backend && uv run python -c "from app.main import app; print([r.path for r in app.routes if r.path.startswith('/notifications')])"`. Must list exactly 4 paths: `/notifications`, `/notifications/{notification_id}/read`, `/notifications/send`, `/notifications/scan-deadlines`.
- [ ] T044 Run the alembic migration in a fresh test DB: `cd backend && uv run alembic upgrade head` (against a sqlite URL pointing at a temp file). Verify the table + indexes exist via `uv run python -c "..."` introspection. Run `alembic downgrade -1` and verify the table is gone.
- [ ] T045 Full sweep: `cd backend && uv run pytest -v`. All prior 258 tests + ≥30 new notifications tests must PASS (target ≥288). On any regression, STOP and fix.
- [ ] T046 Mark every task `[X]` in this file as it completes. The greenstage PHR records the final pass count.

---

## Dependencies

```text
Phase 1 (Setup)        → blocks all later phases
Phase 2 (Foundational) → blocks US1, US2, US3, US4
US1 (feed + mark-read) → independent of US2/US3/US4 (consumer surface)
US2 (producers)        → uses publish() defined in US2 phase itself; depends on Foundational
US3 (broadcast)        → independent of US2 (different write path); depends on Foundational
US4 (email channel)    → augments US2's publish + US3's broadcast — runs after both are green
Polish (T041–T046)     → runs last; T045 is the final gate
```

## Parallel execution opportunities

- **T002 + T003 + T004 + T005**: independent files in Phase 1.
- **T008 + T009 + T010 + T011**: independent files in Phase 2 once T006 + T007 are committed.
- **T012 (test) and T013/T014/T015 (impl)**: write the test first, then impl in T013–T017 sequentially.
- **T020, T029, T035**: the three story-test files can be authored in parallel ahead of their respective implementations (TDD pattern).
- **T025 + T026 + T027**: producer hooks in different files; safe to wire concurrently after T022 ships.
- **T041**: parallel with T042–T044 (different surfaces).

## Implementation strategy — MVP first

- **MVP** = US1 + US2 (P1 + P1). The feed is the consumer surface; producers are what makes it non-empty. Both must ship together to deliver any value.
- **Iteration 2** = US3. Adds admin broadcast.
- **Iteration 3** = US4. Adds email channel.
- Each iteration leaves the codebase green, with no half-finished features. The audit script and the 30-test target are non-negotiable for the iteration that closes the feature.
