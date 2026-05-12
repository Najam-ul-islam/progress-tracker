# Phase 0 Research: Notifications

**Feature**: 008-notifications
**Date**: 2026-05-09

## Decision 1 — Inverted dependency topology

- **Decision**: `notifications` imports **only** `users.repository`, `users.model`, `auth.dependencies`, `auth.schema`. Upstream modules (`projects`, `payments`) import `notifications.service.publish` to emit feed entries. The reverse direction is forbidden by the audit script.
- **Rationale**:
  - Keeps the notifications module a **leaf** — it has no business-logic dependencies and can therefore absorb every other side-effect domain (audit log, webhook fan-out, metrics emission) without accreting imports.
  - Avoids fragile cross-module references. If `notifications` imported `payments.repository.get_payment_by_id` to render `"Your payment of $X for Project Y is now paid"`, every payments rename, schema change, or rebrand would force a notifications change. With prerendered strings, payments owns its display vocabulary forever.
  - Producers know their context better than notifications ever could (e.g., the project name, the module name, the developer name). Asking the producer to hand a finished string is the pit-of-success path.
- **Alternatives considered**:
  1. *Pull model: `notifications` imports `projects` / `payments` repositories and renders messages on its own.* Rejected — bidirectional coupling and rendering vocabulary scattered across two modules.
  2. *Event bus / publish-subscribe with a serialised payload.* Rejected — overkill for in-process emission, adds a serialiser and a queue with no requirement that justifies them. Promotion path remains open later.
- **ADR candidate**: yes — surface at PR time as `📋 Architectural decision detected: notifications-import-topology — Document reasoning and tradeoffs? Run /sp.adr notifications-import-topology`.

## Decision 2 — Mark-read is irreversible

- **Decision**: `PATCH /notifications/{id}/read` is one-way. First-read wins, `read_at` immutable, no `mark-unread` endpoint, no `DELETE`.
- **Rationale**:
  - Audit-trail preservation: `read_at` is the historical record of when the user first acknowledged the notification. Re-marking unread destroys that record.
  - Idempotency: subsequent calls return 200 with the original `read_at`. No surprises for clients that retry.
  - YAGNI: no current product requirement asks for unread-toggle. Adding it later is non-breaking (new endpoint, separate column or a nullable `unread_at`).
- **Alternatives considered**:
  1. *Toggle endpoint.* Rejected — would require a second column to track the latest state separately from the first-read time.
  2. *Read tracking via separate `notification_reads` table.* Rejected — over-engineered for a single-actor feed. The current shape supports per-recipient reading because each row already has a single `user_id`.

## Decision 3 — Cross-user PATCH/read returns 404, not 403

- **Decision**: When user A calls `PATCH /notifications/17/read` and notification 17 belongs to user B, the API returns **404**. Existence of B's notifications is not leaked.
- **Rationale**: 403 confirms the resource exists, which is itself private information. 404 is the correct privacy-preserving status — it conflates "doesn't exist for you" with "doesn't exist at all", which is exactly the affordance we want.
- **Trade-off**: a developer receiving 404 cannot distinguish "I have a typo" from "this isn't mine". Acceptable — same response for both branches is the goal.
- **Alternatives considered**:
  1. *403.* Rejected — leakage.
  2. *Custom 4xx with a hint.* Rejected — over-engineered; HTTP semantics already cover the case cleanly.

## Decision 4 — Email channel inside notifications module, gated by env flag

- **Decision**: Email delivery lives inside `notifications.service` behind a `BackgroundTasks` queue. SMTP transport is gated behind `NOTIFICATIONS_SMTP_ENABLED` env flag. Default off → the channel logs would-send messages and exits cleanly. With the flag on, it dispatches via `aiosmtplib` (added via `uv add` only when ops opts in).
- **Rationale**:
  - Keeps the channel decision local to one module (no separate emails module to maintain in v1).
  - `BackgroundTasks` runs after the response is sent — API latency is unaffected by SMTP timing.
  - Flag-gated transport means tests run without SMTP, dev runs without SMTP, and prod can enable it independently.
  - Promotion to a real worker (Celery/RQ) later is a swap of the enqueue primitive, not a redesign.
- **Alternatives considered**:
  1. *Separate `email` module.* Rejected — the only client of email today is notifications. A module without consumers is over-architected.
  2. *Synchronous SMTP send inside the request.* Rejected — every notification API call would pay SMTP latency, and SMTP failures would propagate to the caller.

## Decision 5 — Deadline-scan endpoint co-located in notifications

- **Decision**: `POST /notifications/scan-deadlines` (admin-only) is part of the notifications module. It walks active projects with `end_date` within a configurable lookahead window and emits one `deadline` notification per recipient per `(project_id, recipient_id, calendar_date)`.
- **Rationale**:
  - The scan's only output is notifications. Co-locating with the producer avoids a one-of-everything `scheduling` module that has no other consumers yet.
  - Idempotency lives at the same layer that owns the dedup key — single source of truth.
  - When more periodic scans accrete (overdue payment chase, idle developer warnings), splitting into a `scheduling` module is a clean refactor — but premature today.
- **Alternatives considered**:
  1. *Module of its own.* Deferred. Re-evaluate if 3+ scan types accumulate.
  2. *Internal-only function (no HTTP endpoint).* Rejected — the future scheduler needs an HTTP entry point.

## Decision 6 — Direct writes by upstream modules are forbidden

- **Decision**: Only `notifications.service.publish` may insert into the `notifications` table. Audit script verifies that no `.py` file outside `app/modules/notifications/` references `Notification` for writes (no `session.add(Notification(...))` outside the module).
- **Rationale**:
  - `publish` is the single boundary that enforces type-enum validation, title/message length bounds, recipient existence + activeness, transactional binding, and email-channel enqueue. Skipping it bypasses every invariant.
  - Single chokepoint = single place to add future validation, observability, or rate-limits.
- **Alternatives considered**:
  1. *Free-form direct writes from upstream modules.* Rejected — would require duplicating every invariant in every caller.

## Decision 7 — Broadcast is all-or-nothing

- **Decision**: When `POST /notifications/send` includes a `recipients.user_ids` list and any id is invalid (not found or soft-deleted), the **entire request** is rejected with 422 listing the invalid ids. No partial fan-out.
- **Rationale**: half-broadcasts are the worst failure mode for ops — you cannot tell what was sent and what wasn't. All-or-nothing makes retries safe and observability simple.
- **Alternatives considered**:
  1. *Best-effort partial fan-out with a per-recipient status array.* Rejected — caller now has to reconcile a per-recipient response, and idempotent retries become a guess.

## Decision 8 — Dedup key is selective (NULL except for scan rows)

- **Decision**: The `dedup_key` column is nullable text. Only the deadline-scan path sets it (format: `f"deadline:{project_id}:{calendar_date}"`). Manual broadcasts, event-driven `assignment` / `payment` / `payment_paid` rows leave it NULL. The unique constraint is partial: `unique(user_id, dedup_key) WHERE dedup_key IS NOT NULL`.
- **Rationale**:
  - Legitimate repeat events (e.g., 3 payments in one day for the same developer) **should** create 3 separate notifications — they are 3 separate facts.
  - Daily deadline-scans **must not** duplicate, because each is the same fact restated.
  - A single dedup column with selective use covers both cases without two columns or two tables.
- **SQLite portability**: SQLite treats NULL as distinct, so a plain unique `(user_id, dedup_key)` index works there. PostgreSQL needs the partial form (`WHERE dedup_key IS NOT NULL`) to allow multiple NULL entries per user. The alembic revision uses `Index(..., postgresql_where=...)` for the partial form on prod and a regular unique index in the dev SQLite path.

## Decision 9 — Pagination defaults

- **Decision**: `GET /notifications` default page size is **50**, max **200**. `limit > 200` returns 422.
- **Rationale**: keeps payloads small enough for mobile clients, large enough that a typical user fetching their feed once gets the full unread set in a single page. Caps prevent runaway payloads on adversarial input.
- **Alternatives considered**:
  1. *Cursor-based pagination.* Deferred — limit/offset is sufficient for the projected scale (≤100k rows). Cursor is a worthwhile upgrade once feeds reach the millions.

## Decision 10 — Pre-rendered message strings, not templates

- **Decision**: Producers (`projects.service`, `payments.service`) format the title and message as plain strings before calling `publish`. Notifications stores the rendered string verbatim. There is no template engine, no late-binding interpolation, no per-recipient rendering.
- **Rationale**:
  - Consistent with Decision 1: producers own their vocabulary.
  - Late-binding rendering would mean storing a template id + a JSON of values, then re-rendering on read — adds two surfaces (template registry + renderer) for no current product requirement.
  - i18n is not yet a requirement. When it becomes one, the migration is to add a `template_id` + `template_args` column alongside `title`/`message` and render at fetch time. That's a future-feature concern.
