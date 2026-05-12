# Implementation Plan: Notifications

**Branch**: `008-notifications` | **Date**: 2026-05-09 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/008-notifications/spec.md`

## Summary

Stand up the `notifications` module: a six-file modular slice that **owns one new SQLModel table** (`notifications`), exposes three HTTP endpoints under `/notifications`, and offers one internal entry point (`notifications.service.publish`) that upstream modules (`projects`, `payments`) call to emit feed entries transactionally. RBAC: `GET /notifications` and `PATCH /notifications/{id}/read` are caller-scoped (any authenticated user sees only their own); `POST /notifications/send` is admin-only. Cross-user `PATCH` returns **404** (not 403) to avoid leaking notification existence (FR-005).

The dependency topology is **inverted** versus the prior features: `notifications` imports only `users.repository`, `users.model`, `auth.dependencies`, `auth.schema`. It depends on **no business module**. The reverse direction is intentional — `projects.service` and `payments.service` import `notifications.service.publish` to emit `assignment` / `payment` / `payment_paid` rows. This keeps notifications a leaf module so future side-effect features (audit log, webhook fan-out, metrics emission) can adopt the same shape.

The email channel (US4, P3) runs via FastAPI `BackgroundTasks` — async, best-effort, never raises to the API caller. Promotable to a real worker (Celery/RQ) later without API changes.

**Technical approach** (validated in [`research.md`](./research.md)):

- Six-file modular layout under `backend/app/modules/notifications/`. The feature **fills all six** (`model.py` carries the new SQLModel; `dependencies.py` is empty because `auth.dependencies` is reused).
- One alembic revision creates the `notifications` table with FK to `users(id)`, indexes on `(user_id, created_at DESC)` and a unique partial index `(user_id, dedup_key) WHERE dedup_key IS NOT NULL` (FR-015).
- The publish entry point is a single function `publish(session, *, recipient_id, title, message, type, dedup_key=None, email_channel=False)` that validates type/length, resolves the recipient is active, performs the insert in the **caller's transaction** (FR-013), and optionally enqueues an email background task. It raises typed exceptions (`InvalidNotificationType`, `InvalidNotificationContent`, `RecipientNotFound`, `RecipientInactive`) — the API layer maps to 422.
- Broadcast fan-out (`POST /notifications/send`) resolves recipients via one of three selectors (`{ all }`, `{ role }`, `{ user_ids }`) → exactly-one validation in schema (FR-018) → all-or-nothing fan-out via SQL bulk insert (FR-019).
- Routes contain zero business logic; they validate, dispatch to service, map typed exceptions to HTTP status, and return Pydantic v2 envelopes.
- Test surface: SQLite-in-memory `TestClient` reusing `seed_admin / seed_manager / seed_developer / auth_header`. New helper `seed_notifications_landscape` prebuilds a multi-user / multi-type / mixed-read fixture used by feed/read/broadcast tests. Producer wiring is exercised in upstream-module tests (`test_notifications_producers.py`) by triggering an assignment/payment and asserting a row lands.
- Audit script `audit_notifications_imports.sh` enforces (a) the FR-024 import allow-list on `notifications/**`, and (b) the inverse rule that no module outside `notifications/**` writes directly to the `notifications` table (only `notifications.service.publish` is allowed to insert).

## Technical Context

**Language/Version**: Python 3.13.

**Primary Dependencies** (already installed — **no additions**):

- `fastapi`, `sqlmodel`, `pydantic` v2, `pydantic-settings`.
- `sqlalchemy` (transitive) — for `select`, `func`, `insert`, `update`, partial-unique constraints.
- `fastapi.BackgroundTasks` (built-in) for the email channel.
- `email.message.EmailMessage` + `aiosmtplib` if SMTP delivery is wired up. **Decision**: in this iteration we ship the channel **interface and the in-process queue**, but real SMTP transport is gated behind a `NOTIFICATIONS_SMTP_ENABLED` env flag. Default off → channel logs would-send messages and exits cleanly. This avoids adding a runtime SMTP dependency until ops is ready. (See research.md.)
- **No new pinned dependencies** introduced unless the user opts into SMTP (`uv add aiosmtplib` only when enabling the feature flag — explicitly **not** at green-stage).

**Decimal arithmetic**: not used. Notifications carry strings only; the upstream caller renders monetary values into the `message` body before calling `publish`.

**Test deps** (already present): `pytest`, `pytest-asyncio`, `httpx`. No SMTP mock library is added; tests assert on the BackgroundTasks queue contents and on log output for the email channel.

**Storage**: PostgreSQL for dev/prod; SQLite in-memory + `StaticPool` for tests. Both engines support `unique` partial indexes — for SQLite we emulate via a regular composite unique index `(user_id, dedup_key)` (NULL is treated as distinct, which is the behavior we want). The alembic revision uses `Index(..., postgresql_where=...)` for the partial form on prod and a plain unique index on dev SQLite.

**Testing**: `pytest` + FastAPI `TestClient`. Test files mapping to user stories:

- `test_notifications_feed.py` (US1 — ≥8 cases: list ordering, pagination, unread_count, empty feed, mark-read happy path, mark-read idempotent, mark-read 404 cross-user, role-agnostic feed scoping)
- `test_notifications_producers.py` (US2 — ≥8 cases: assignment emit, payment emit, payment_paid emit, deadline scan emit, scan idempotency on same day, transactional rollback binding, dedup key uniqueness on scan, type rejection at publish boundary)
- `test_notifications_broadcast.py` (US3 — ≥7 cases: role selector exact fan-out, user_ids selector, all selector, manager forbidden, exactly-one-of selector validation, invalid user_ids reject all-or-nothing, soft-deleted user excluded from broadcast)
- `test_notifications_email_channel.py` (US4 — ≥4 cases: enabled-channel happy path, smtp failure swallowed, broadcast opt-in flag, dedup-on-replay)
- `test_notifications_audit.py` (≥3 cases: FR-024 import allow-list, no upstream module writes the notifications table directly, no `session.commit/delete/merge` outside service.publish)

Total target: ≥30 cases (matches SC-009).

**Target Platform**: Linux server (containerised) for prod; Windows 10 + native Python for dev.

**Project Type**: web-application backend (`backend/`). This feature only touches `backend/`.

**Performance Goals**:

- 95th percentile of `GET /notifications` under 500 ms on 100,000 rows / 1,000 users (SC-001). Single indexed scan on `(user_id, created_at DESC)` plus a count.
- `PATCH /notifications/{id}/read` ≤ 1 round-trip; `POST /notifications/send` bounded by recipient resolution (1 SELECT) + bulk INSERT (1 round-trip), independent of recipient count beyond the bulk insert itself (FR-025).

**Constraints**:

- **uv-only** for dependency and runtime usage. No `uv add` invocations in this feature unless the user explicitly opts into the SMTP transport.
- **Non-destructive integration**: existing modules must keep importing cleanly. Files outside `notifications/` touched by this feature:
  1. One alembic revision under `backend/alembic/versions/`.
  2. One new audit script `backend/scripts/audit_notifications_imports.sh`.
  3. One-line addition to `app/main.py` `MODULE_REGISTRY` (`("notifications", "/notifications")`) — already present in the registry; verify prefix matches.
  4. One conftest update to import the `Notification` model so `Base.metadata.create_all` picks it up.
  5. **Producer hooks** in `app/modules/projects/service.py` (assignment) and `app/modules/payments/service.py` (payment create + payment_paid transition) — call `notifications.service.publish` with prerendered title/message strings. These are the only mutations to existing modules.
- **No business logic in routes**; routes call services only and map typed exceptions to HTTP statuses.
- **Six-file layout per module** is mandatory; `dependencies.py` is intentionally an empty stub.
- **Module boundaries** (FR-024): `notifications` may import only from `users.repository`, `users.model`, `auth.dependencies`, `auth.schema`. Importing from `projects` or `payments` siblings is **forbidden**. The audit script encodes the allow-list.
- **Append-only contract**: notifications module performs `INSERT` and a single `UPDATE` (mark-read). It never `DELETE`s. The audit script forbids `session.delete(` and `session.merge(` inside `notifications/**`.
- **401 → 403 → 404 → 422 ordering** preserved on every route; cross-user PATCH returns 404 not 403 (FR-005).
- **Privacy invariant**: `GET /notifications` returns only the caller's own notifications regardless of role. Admins do not see other users' feeds — they use the broadcast/send surface instead (FR-004).
- **Transactional binding**: `publish` writes within the caller's session. If the caller commits, the row is durable; if the caller rolls back, the row is gone (FR-013). The audit pytest verifies this with an induced rollback fixture.

**Scale/Scope**: 3 HTTP endpoints + 1 internal publish entry point + 1 deadline-scan endpoint, 1 new SQLModel + 1 alembic revision, ~700 LOC of code, ~600 LOC of tests, ≥30 test cases, 1 new dependency only if SMTP is opt-in enabled.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository's `.specify/memory/constitution.md` is currently a placeholder. The de-facto constitution carried forward from features 003–007 is captured here and verified:

| Principle (de-facto) | Compliance |
|---|---|
| Six-file modular layout per module | ✅ `model / schema / repository / service / routes / dependencies` (one empty stub) |
| Zero business logic in routes | ✅ routes only validate, dispatch, and map exceptions |
| Centralised service layer for all logic + RBAC scoping | ✅ all logic in `notifications.service` (publish, list, mark-read, broadcast, scan-deadlines) |
| Per-feature import allow-list | ✅ encoded in `audit_notifications_imports.sh` (FR-024) |
| 401 → 403 → 404 → 422 ordering | ✅ each route's try/except chain in that order; cross-user PATCH explicitly returns 404 (FR-005) |
| uv-only for deps and runtime | ✅ no `uv add` invocations in this feature unless SMTP opt-in |
| Append-only contract preservation | ✅ no `DELETE`; only `INSERT` + a single `UPDATE` (mark-read) — audit script enforces |
| Cross-module side-effects via explicit service entry, not direct DB writes | ✅ `notifications.service.publish` is the sole insert path; audit script forbids upstream modules from writing the table |
| Test surface ≥ functional coverage | ✅ ≥30 test cases targeted (SC-009); ≥1 test per FR |
| No 500 on valid authenticated requests | ✅ defensive validation at the service boundary; structured 422 / 404 / 403 / 401 exits |

**Result**: PASS. No violations. Complexity Tracking section omitted (no exceptions to justify).

## Project Structure

### Documentation (this feature)

```text
specs/008-notifications/
├── spec.md              # already authored by /sp.specify
├── plan.md              # this file
├── research.md          # Phase 0 — chosen topology, channel strategy, dedup design
├── data-model.md        # Phase 1 — Notification entity + DTO shapes
├── quickstart.md        # Phase 1 — curl walk-through of feed + broadcast + producer
├── contracts/
│   └── notifications.openapi.yaml   # 3 HTTP endpoints + 1 admin scan endpoint
├── checklists/
│   └── requirements.md  # already authored by /sp.specify
└── tasks.md             # generated by /sp.tasks
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── main.py                                  # verify ("notifications", "/notifications") in MODULE_REGISTRY
│   └── modules/
│       ├── notifications/
│       │   ├── __init__.py
│       │   ├── model.py                         # Notification SQLModel + NotificationType enum
│       │   ├── schema.py                        # Pydantic v2 envelopes (feed, broadcast, publish-internal)
│       │   ├── repository.py                    # SELECT/INSERT/UPDATE primitives, no business logic
│       │   ├── service.py                       # publish, list_for_user, mark_read, broadcast, scan_deadlines
│       │   ├── routes.py                        # 3 HTTP routes + admin scan-deadlines route
│       │   └── dependencies.py                  # empty stub (uses auth.dependencies)
│       ├── projects/
│       │   └── service.py                       # +1 publish call on developer assignment
│       └── payments/
│           └── service.py                       # +2 publish calls (payment create, payment_paid transition)
├── alembic/
│   └── versions/
│       └── 20260510_create_notifications_table.py  # one revision: notifications table + indexes
├── scripts/
│   └── audit_notifications_imports.sh           # FR-024 enforcement + upstream-write ban
└── tests/
    ├── _notifications_helpers.py                # seed_notifications_landscape + email-channel collector
    ├── test_notifications_feed.py               # US1
    ├── test_notifications_producers.py          # US2
    ├── test_notifications_broadcast.py          # US3
    ├── test_notifications_email_channel.py      # US4
    └── test_notifications_audit.py              # FR-024 + append-only invariants
```

**Structure Decision**: Six-file modular layout under `backend/app/modules/notifications/`, identical to features 003–007. `dependencies.py` is an intentional empty stub because the feature uses `auth.dependencies` directly. Producer hooks in `projects` and `payments` are minimal (one to two import lines + one publish call per upstream service function). The hooks live **in the upstream module's service layer**, never in routes.

## Phase 0: Outline & Research

See [`research.md`](./research.md). Resolved questions:

1. **Should `notifications` import from `projects` / `payments` to fetch context, or should producers hand prerendered strings?** → producers hand prerendered strings. Rationale: keeps notifications a leaf module; avoids fragile cross-module refs that break on entity rename.
2. **Should mark-read be reversible?** → no in this iteration. First read wins, `read_at` immutable. Mark-unread can be added later as a separate endpoint without breaking the contract.
3. **Should cross-user PATCH return 403 or 404?** → 404. 403 leaks the existence of the row, which is itself private information. (FR-005, captured in spec edge cases.)
4. **Should the email channel live inside this module or be a separate module?** → inside this module, behind a `BackgroundTasks` boundary and a `NOTIFICATIONS_SMTP_ENABLED` env flag. Promotion to a separate worker module is a future migration, not this feature's job.
5. **Where does the deadline-scan endpoint live?** → `POST /notifications/scan-deadlines`, admin-only, idempotent per `(project_id, recipient_id, calendar_date)`. Co-located in notifications because it has no other home and its only output is notification rows. A scheduler is out of scope; the endpoint exists so a future scheduler can hit it.
6. **Should producers write directly to the table, or call `publish`?** → `publish`. Direct writes are forbidden by audit script. Reason: `publish` is the single boundary where type validation, recipient resolution, transactional binding, and email-channel enqueue live. Skipping it bypasses every invariant.
7. **Should broadcast fan-out be transactional?** → yes (single bulk insert). Either every recipient row is created or none (FR-019). Avoids the half-broadcast failure mode.
8. **What is the dedup key shape?** → free-form text, NULL by default, used only by the scan path with the format `f"deadline:{project_id}:{calendar_date}"`. Manual broadcasts and event-driven rows leave it NULL (FR-015).

## Phase 1: Design & Contracts

See [`data-model.md`](./data-model.md) for the `Notification` SQLModel + DTO shapes (one new table, no schema changes elsewhere) and [`contracts/notifications.openapi.yaml`](./contracts/notifications.openapi.yaml) for the OpenAPI 3.1 contract covering the 4 HTTP endpoints. See [`quickstart.md`](./quickstart.md) for the end-to-end walk-through covering feed read, mark-read, broadcast send, deadline scan, and an upstream-producer trigger.

Re-evaluation post-design: Constitution Check still PASS. The producer hooks in `projects.service` and `payments.service` are explicit and minimal (3 hook points total — assignment, payment-create, payment-paid). Each is a one-line `publish(session, recipient_id=..., title=..., message=..., type=...)` call inside the existing transaction. No business logic moves to upstream modules.

## Complexity Tracking

> No violations to justify. The feature deliberately introduces:
>
> - **One** new table (`notifications`).
> - **One** alembic revision.
> - **Three** producer hooks across two upstream modules — minimal, single-line, inside existing transactions.
> - **Zero** new pinned Python dependencies (SMTP transport is opt-in via env flag and `uv add aiosmtplib` only at the moment ops enables it).
>
> The feature's biggest design choice is the **inverted import topology** (FR-024): `notifications` imports only `users` + `auth`, and upstream modules import `notifications.service.publish`. This was chosen specifically to keep the notifications module a leaf so it can absorb future side-effect domains (audit log, webhook fan-out) without growing imports. The alternative — having `notifications` import from `projects` / `payments` to render messages on its own — was rejected because it forces every upstream entity rename to break notifications. Documented as ADR candidate in research.md.
