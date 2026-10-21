# Feature Specification: Notifications

**Feature Branch**: `008-notifications`
**Created**: 2026-05-09
**Status**: Draft
**Input**: User description: "MODULE: Notifications — manage system notifications for projects, assignments, payments, and deadlines. In-app + email delivery. Per-user feed with read tracking. Admin can broadcast/send. Modular architecture, async-ready, no business logic in routes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User reads their own in-app notification feed (Priority: P1)

A logged-in user (admin, manager, or developer) opens their notification feed and sees the list of notifications addressed to them in reverse-chronological order. Each row shows the title, message body, type (assignment, payment, deadline, system), whether it has been read, and when it was created. They can mark a single notification as read by tapping it; the unread count drops accordingly. Until a feed exists, every other notification feature is invisible to the user — this is the foundational consumer surface.

**Why this priority**: Without a per-user feed and read tracking, no event ever reaches the user, regardless of how many publishers fire. P1 because it is the *only* user-visible surface in this feature; every later story is either a producer of feed entries or a delivery channel that supplements it.

**Independent Test**: Seed three notifications for user A and two for user B (mixed read/unread). As user A, request `GET /notifications` — exactly three rows return, in reverse-chronological order, with the correct read flags. PATCH one row read; re-fetch — that row's `is_read` is true and the unread count is one lower.

**Acceptance Scenarios**:

1. **Given** user A has 3 notifications (2 unread, 1 read) and user B has 2 notifications, **When** user A requests `GET /notifications`, **Then** the response lists exactly A's 3 notifications in `created_at` descending order with their correct `is_read` flags and an `unread_count = 2`.
2. **Given** user A has an unread notification with id 17, **When** user A calls `PATCH /notifications/17/read`, **Then** the row's `is_read` becomes true, `read_at` is populated with the server timestamp, and a subsequent `GET /notifications` shows `unread_count` decremented by exactly one.
3. **Given** user A calls `PATCH /notifications/17/read` and that notification belongs to user B, **Then** the call returns 404 (not 403) so that the existence of B's notifications is not leaked.
4. **Given** user A has zero notifications, **When** they request `GET /notifications`, **Then** the response is `{ items: [], unread_count: 0, total: 0 }` — never null, never an error.
5. **Given** user A's feed has 250 entries, **When** they request `GET /notifications?limit=50&offset=0`, **Then** exactly 50 rows return and `total = 250`.

---

### User Story 2 - System auto-creates notifications on key events (Priority: P1)

When something meaningful happens elsewhere in the system — a developer is assigned to a module, a payment is generated or marked paid, a project deadline is approaching or has slipped — the notifications module records a feed entry for the right recipient(s) without any manual step. The user sees the entry the next time they open their feed.

**Why this priority**: Without producers, the feed in US1 is permanently empty. P1 because the notifications feature has no value until at least one event type writes to the feed. Both must ship together for a real MVP.

**Independent Test**: Trigger an assignment event in the projects module (assign developer D to module M). Without any further action, request `GET /notifications` as developer D — a single notification appears with `type = 'assignment'`, a non-empty title and message, and `created_at` within the last second.

**Acceptance Scenarios**:

1. **Given** project P has module M with no assigned developer, **When** an admin assigns developer D to module M (existing projects flow), **Then** a notification with `type = 'assignment'`, `user_id = D.id`, and a message that includes the project name and module name is created within the same request boundary.
2. **Given** module M has a payment generated for developer D in the amount `350.00`, **When** the payment row is created (existing payments flow), **Then** a notification with `type = 'payment'`, `user_id = D.id`, message containing the amount, is created.
3. **Given** a developer payment moves from `pending` to `paid`, **When** the status transition happens, **Then** a notification with `type = 'payment_paid'` is created for the recipient developer.
4. **Given** a project's `end_date` is 3 calendar days away and the project is still `active`, **When** the deadline-scan runs (scheduled or on-demand), **Then** a notification with `type = 'deadline'` is created exactly once for the responsible manager and admin set; running the scan again on the same day MUST NOT create a duplicate.
5. **Given** any of the upstream modules (projects, payments) raise an exception while creating their own data, **When** that exception propagates, **Then** no notification row is left orphaned — notification creation is part of the same transactional boundary as the originating event.

---

### User Story 3 - Admin sends a manual / broadcast notification (Priority: P2)

An administrator needs to push an arbitrary message — a maintenance window, a policy change, a one-off congratulation — to a specific user, a role group, or every user in the system. They use a single endpoint with a recipient selector and a message body; the system fans the message out into the appropriate per-user feed entries.

**Why this priority**: Manual broadcast covers the long tail of operational communication that the auto-emitters in US2 don't model. P2 because the system can ship and be useful without it (auto-events alone deliver the assignment + payment + deadline channels).

**Independent Test**: As admin, POST `{ recipients: { role: "developer" }, title: "...", message: "...", type: "system" }`. Without further action, request `GET /notifications` as each developer in the system — every developer sees exactly one new notification with the supplied title/message; non-developers see nothing new.

**Acceptance Scenarios**:

1. **Given** the system has 3 developers, 2 managers, 1 admin, **When** admin POSTs with `recipients = { role: "developer" }`, **Then** exactly 3 notification rows are created (one per developer) with identical title/message and `type = 'system'`.
2. **Given** admin POSTs with `recipients = { user_ids: [4, 7] }`, **When** the request succeeds, **Then** exactly 2 rows are created — one for user 4 and one for user 7.
3. **Given** admin POSTs with `recipients = { all: true }`, **When** the request succeeds, **Then** one notification per active user is created (soft-deleted users are excluded).
4. **Given** a manager (not admin) attempts `POST /notifications/send`, **Then** the request is rejected with 403.
5. **Given** admin POSTs with an empty recipient set (no role, no user_ids, all=false), **Then** the request is rejected with 422.

---

### User Story 4 - Email delivery for high-importance events (Priority: P3)

For event types flagged as high-importance (default: `assignment` + `payment_paid` + `deadline`), the system also dispatches an email to the recipient's address in addition to writing the in-app feed row. Email delivery is asynchronous and best-effort: a delivery failure must not roll back the in-app notification.

**Why this priority**: P3 because the in-app feed alone is sufficient for the MVP. Email is a delivery-channel enhancement that requires SMTP credentials, a worker, and tolerance for a third-party dependency. It is independently shippable later without breaking US1–US3.

**Independent Test**: Configure the email channel against a stub SMTP collector. Trigger an assignment for developer D whose email is `d@example.com`. The collector receives one message addressed to `d@example.com` with a subject derived from the notification title; the in-app row is created and visible regardless of whether the SMTP collector is reachable.

**Acceptance Scenarios**:

1. **Given** D's email is set and the channel is enabled, **When** an `assignment` notification fires for D, **Then** the in-app row appears immediately and a single email is dispatched to D's address with the notification title and message.
2. **Given** the email channel is misconfigured (SMTP unreachable), **When** an `assignment` notification fires, **Then** the in-app row still appears and the email failure is logged but not raised to the API caller.
3. **Given** the notification type is `system` (broadcast), **When** the broadcast is sent, **Then** by default no email is dispatched — broadcasts are in-app only unless the admin explicitly opts in via a flag.
4. **Given** the same in-app notification would otherwise trigger a duplicate email (replay, scan re-run), **Then** the email channel deduplicates so each unique notification id results in at most one email attempt.

---

### Edge Cases

- **Read-flag idempotency.** Calling `PATCH /notifications/{id}/read` on a notification that is already read MUST succeed with 200 and leave `read_at` unchanged (first-read wins). Marking read MUST NOT be reversible from the API in this iteration.
- **Cross-user access.** A user attempting to read or mark another user's notification MUST receive 404 (not 403) — leaking the existence of someone else's row is a privacy regression we explicitly avoid. Admins are the sole exception: they MAY observe any notification via the broadcast/send surface but MUST NOT see other users' feeds via `GET /notifications`.
- **Soft-deleted users.** When a user is soft-deleted, their notification rows MUST be retained (audit trail) but MUST NOT be returned to anyone's feed and MUST NOT be re-broadcast to.
- **Deadline-scan idempotency.** Running the deadline scan twice on the same calendar day for the same project MUST produce at most one `deadline` notification per recipient. The de-dup key is `(project_id, recipient_id, type, calendar_date)`.
- **Notification on event-source rollback.** If the source-of-truth transaction (e.g., creating a project_module assignment) rolls back, the corresponding notification MUST also roll back — the two writes share a transaction.
- **Pagination defaults.** When neither `limit` nor `offset` is supplied, the feed returns at most the 50 most recent rows. `limit > 200` MUST be rejected with 422 to bound payload size.
- **Type enum closed.** `type` MUST be one of a closed set: `assignment | payment | payment_paid | deadline | system`. Unknown types coming from upstream code paths MUST be rejected at the service-layer boundary, not silently accepted into the database.
- **Notification body length.** Title is bounded (≤120 characters); message is bounded (≤2,000 characters). Longer values MUST be rejected with 422 — never silently truncated.
- **No edit, no delete.** This iteration is append + mark-read only. There is no PATCH for editing content and no DELETE — supporting either would complicate the audit trail and is out of scope.

## Requirements *(mandatory)*

### Functional Requirements

#### Endpoints & RBAC (FR-001 — FR-007)

- **FR-001**: System MUST expose `GET /notifications` returning the authenticated caller's own notifications in `created_at` descending order, with `limit` (default 50, max 200) and `offset` (default 0) pagination, plus an `unread_count` and `total` in the envelope.
- **FR-002**: System MUST expose `PATCH /notifications/{id}/read` which marks the addressed notification as read and stamps `read_at` with the server time. Idempotent: subsequent calls succeed with 200 and do not change `read_at`.
- **FR-003**: System MUST expose `POST /notifications/send` (admin only) accepting a `recipients` selector (one of `{ all: true }`, `{ role: "<role>" }`, `{ user_ids: [...] }`), `title`, `message`, and optional `type` (default `system`). The endpoint fans out into one row per resolved recipient.
- **FR-004**: `GET /notifications` MUST return only the caller's own notifications regardless of role. Admins do not see other users' feeds via this endpoint; the broadcast/send endpoint is the only admin-shaped surface.
- **FR-005**: `PATCH /notifications/{id}/read` on a notification not owned by the caller MUST return 404 (not 403), to avoid leaking existence of other users' notifications.
- **FR-006**: `POST /notifications/send` MUST be authorised for admin only; manager and developer MUST receive 403.
- **FR-007**: Unauthenticated requests to any endpoint MUST return 401. The 401 → 403 → 404 → 422 guard ordering MUST be honoured on every route.

#### Producers & event sourcing (FR-008 — FR-013)

- **FR-008**: When a developer is assigned to a project module (existing projects flow), the system MUST create a notification with `type = 'assignment'`, `user_id = developer.id`, in the same transaction as the assignment write.
- **FR-009**: When a payment row is created with developer-payment children (existing payments flow), each developer-payment recipient MUST receive a `type = 'payment'` notification in the same transaction.
- **FR-010**: When a developer-payment transitions from `pending` to `paid`, the recipient MUST receive a `type = 'payment_paid'` notification.
- **FR-011**: A deadline scan (callable as `POST /notifications/scan-deadlines`, admin-only, plus invokable by a future scheduler) MUST emit `type = 'deadline'` notifications for every active project whose `end_date` is within a configurable lookahead window (default 3 calendar days) or already past, addressed to admin and manager users. The scan MUST be idempotent for the same `(project_id, recipient_id, calendar_date)`.
- **FR-012**: All producers MUST go through a single internal service entry point (`notifications.service.publish`) — no upstream module may write to the notifications table directly. This is the boundary where type validation, recipient resolution, and dedup keys are enforced.
- **FR-013**: Notification creation MUST share the source-of-truth transaction. If the source write rolls back, the notification row MUST NOT persist.

#### Data correctness (FR-014 — FR-019)

- **FR-014**: The notification table MUST persist: `id`, `user_id` (recipient FK to users), `title` (≤120), `message` (≤2,000), `type` (enum from FR-021), `is_read` (bool, default false), `read_at` (nullable timestamp), `created_at` (server timestamp at write), and a `dedup_key` (nullable text) used by FR-011 to enforce scan idempotency.
- **FR-015**: A unique constraint on `(user_id, dedup_key)` (with `dedup_key NOT NULL`) MUST prevent duplicate scan-emitted rows for the same recipient on the same day. Manual / broadcast / event-driven rows leave `dedup_key NULL` and are unconstrained.
- **FR-016**: `is_read = true` rows MUST retain their `read_at` value forever; subsequent reads do not overwrite it. The system never auto-marks rows as read on fetch — only the explicit PATCH does.
- **FR-017**: Soft-deleted users (existing convention `is_active = false`) MUST be excluded from broadcast targeting and from receiving any new auto-emitted notifications. Their pre-existing rows remain in the table but are never returned by any endpoint.
- **FR-018**: The recipient selector in `POST /notifications/send` MUST validate that exactly one of `{ all, role, user_ids }` is supplied; supplying zero or more than one MUST return 422.
- **FR-019**: When `recipients.user_ids` is supplied and any id does not correspond to an active user, the entire request MUST be rejected with 422 listing the invalid ids — partial fan-out is forbidden.

#### Type taxonomy & validation (FR-020 — FR-022)

- **FR-020**: The `type` field MUST be one of: `assignment`, `payment`, `payment_paid`, `deadline`, `system`. Other values MUST be rejected at the schema layer with 422.
- **FR-021**: `title` MUST be a non-empty string of ≤120 characters; `message` MUST be a non-empty string of ≤2,000 characters. Whitespace-only values MUST be rejected.
- **FR-022**: `created_at` MUST be set by the server (not the caller). Any client-supplied `created_at`, `is_read`, or `read_at` in `POST /notifications/send` MUST be ignored or rejected.

#### Architecture & non-functional (FR-023 — FR-027)

- **FR-023**: Routes MUST contain zero business logic — only request validation, dependency injection, recipient envelope construction, and exception-to-HTTP mapping. All resolution, fan-out, transaction handling, and dedup MUST live in the service layer.
- **FR-024**: The notifications module MUST only import sibling-module symbols from an explicit allow-list: `users.repository`, `users.model` (read-only — for recipient resolution and role lookup), `auth.dependencies`, `auth.schema`. Importing from `projects` or `payments` siblings is forbidden — instead, those modules import `notifications.service.publish` to emit. This enforces an "everyone depends on notifications, notifications depends on no business module" topology.
- **FR-025**: `GET /notifications` MUST issue at most 2 database round-trips per request (one for the page, one for `unread_count` + `total`). Single-recipient PATCH and single-recipient publish MUST issue at most 1 round-trip each. Broadcast `POST /notifications/send` MUST resolve recipients and write the fan-out in a bounded number of round-trips that is independent of recipient count beyond the bulk-insert itself.
- **FR-026**: The email channel (US4) MUST run asynchronously (via a background task or worker) and MUST NOT extend the API request's response time by more than the cost of enqueueing the job. SMTP failures MUST NOT raise to the API caller.
- **FR-027**: All endpoints MUST be safe to call with no query parameters and MUST never produce a 500 response for valid authenticated requests, even on an empty database.

### Key Entities

- **Notification**: A per-recipient record with `id`, `user_id` (recipient), `title`, `message`, `type` (closed enum), `is_read`, `read_at` (nullable), `created_at`, and `dedup_key` (nullable, used to prevent duplicate scan-emitted rows). One row per (user × event); broadcasts fan out into N rows.
- **NotificationFeedEnvelope**: The shape returned by `GET /notifications` — `items` (list of Notification), `unread_count` (int), `total` (int), plus pagination echoes `limit` and `offset`.
- **PublishRequest** (internal): The cross-module contract that producers use — `recipient_id`, `title`, `message`, `type`, optional `dedup_key`, optional `email_channel` flag. Not exposed to HTTP; only callable from service code in this codebase.
- **BroadcastRequest** (HTTP): The shape accepted by `POST /notifications/send` — `recipients` (one of `{ all }`, `{ role }`, `{ user_ids }`), `title`, `message`, optional `type` (default `system`), optional `email_channel` flag.

### Assumptions

- The notifications module owns one new table (`notifications`) and one alembic migration. No existing tables are altered.
- The deadline-scan is callable on demand at `POST /notifications/scan-deadlines` and is idempotent per calendar day; an actual scheduler (cron, Celery beat, etc.) is out of scope for this feature and will be added later. The endpoint exists so a scheduler can hit it.
- "Today" for the deadline scan is the server's UTC date. Time zones are not part of this feature's scope.
- Email transport configuration (SMTP host, credentials, from-address) is read from environment variables at startup. If unset, the email channel is silently disabled and only the in-app feed runs — this is a valid local-dev configuration.
- The email channel uses a background-task primitive (FastAPI BackgroundTasks for the MVP; promotable to a dedicated worker later). No Celery, RQ, or external broker is required for this iteration.
- Producers in upstream modules (projects, payments) call `notifications.service.publish` directly. The reverse direction (notifications calling into projects or payments) is forbidden by FR-024 — notifications carry only the strings it needs at publish time, not live-fetched references.
- Rate limiting and per-user notification preferences (e.g., "mute deadlines") are out of scope for this iteration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user loads `GET /notifications` and sees a complete, structurally valid envelope in under 500ms on a database with up to 100,000 notification rows and 1,000 users.
- **SC-002**: Read-tracking is correct: marking a single notification read updates exactly one row, leaves `read_at` immutable on subsequent calls, and the unread count returned by the next feed fetch decreases by exactly one — verified by an idempotency test and a counting test.
- **SC-003**: Cross-user isolation is enforced in 100% of attempts — a user requesting another user's notification id receives 404 and never sees the other user's data, verified by a scope-isolation test that seeds two disjoint users.
- **SC-004**: Broadcast fan-out matches the recipient selector exactly: `{ role: "developer" }` against a fixture of 3 developers and 2 managers creates exactly 3 rows; `{ all: true }` creates exactly N rows where N is the count of active users; `{ user_ids: [4, 7] }` creates exactly 2 rows. Verified by row-count assertions across 3 fixtures.
- **SC-005**: Each producer is transactionally bound to its source-of-truth write — an automated test induces a rollback in the projects/payments path and asserts the notifications table count is unchanged.
- **SC-006**: The deadline scan is idempotent for a given calendar day: running it twice on the same fixture creates the same row count as running it once. Verified by a re-run test.
- **SC-007**: Each endpoint issues no more than the FR-025 round-trip budget per request, regardless of dataset size, verified by query counting in the test harness.
- **SC-008**: The audit script (analogous to `audit_payments_imports.sh` and `audit_reporting_imports.sh`) verifies that the notifications module imports only from the FR-024 allow-list and that no upstream business module bypasses `notifications.service.publish` to write directly to the notifications table. Exits 0 in CI.
- **SC-009**: At least 30 automated test cases collectively cover the four user stories, with every functional requirement (FR-001 — FR-027) exercised by at least one passing test.
- **SC-010**: The full backend test sweep (existing 258 tests + new notifications tests) remains green after this feature lands; no regression in any prior module.
- **SC-011**: When the email channel is enabled against a stub SMTP collector, every assignment / payment_paid / deadline event produces exactly one email per recipient, and SMTP failures never propagate to the API caller — verified by 4 channel tests covering happy path, transport failure, broadcast opt-in, and dedup-on-replay.
