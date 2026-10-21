# Phase 1 Data Model: Notifications

**Feature**: 008-notifications
**Date**: 2026-05-09

## New table: `notifications`

| Column        | Type                  | Nullable | Default              | Notes |
|---------------|-----------------------|----------|----------------------|-------|
| `id`          | INTEGER PK            | NO       | autoincrement        | Surrogate. |
| `user_id`     | INTEGER FK users(id)  | NO       | —                    | Recipient. Indexed (composite below). |
| `title`       | VARCHAR(120)          | NO       | —                    | Bounded by FR-021. |
| `message`     | VARCHAR(2000)         | NO       | —                    | Bounded by FR-021. |
| `type`        | VARCHAR(32)           | NO       | —                    | Closed enum, see `NotificationType` below. Stored as string to keep alembic forward-friendly. Validated at the service boundary. |
| `is_read`     | BOOLEAN               | NO       | `false`              | First-read wins. |
| `read_at`     | TIMESTAMPTZ           | YES      | NULL                 | Set when `is_read` first transitions to `true`. Immutable thereafter. |
| `created_at`  | TIMESTAMPTZ           | NO       | `func.now()`         | Server timestamp. |
| `dedup_key`   | VARCHAR(128)          | YES      | NULL                 | Used only by the deadline scan to prevent duplicate emission. NULL for all other rows. |

### Indexes

- `ix_notifications_user_created` on `(user_id, created_at DESC)` — primary query path: feed lookup, ordering.
- `uq_notifications_user_dedup` on `(user_id, dedup_key)` — partial: `WHERE dedup_key IS NOT NULL` (PostgreSQL); plain unique on SQLite (NULL is distinct).
- Implicit index on `(user_id)` from FK is sufficient for join-by-user; no separate index added.

### Constraints

- `CHECK (length(title) BETWEEN 1 AND 120)` — defence in depth (Pydantic validates first).
- `CHECK (length(message) BETWEEN 1 AND 2000)`.
- `FOREIGN KEY (user_id) REFERENCES users(id)` — `ON DELETE CASCADE` is **rejected**: notifications must outlive a soft-delete and may outlive a hard-delete for audit. We use the default `NO ACTION`. Soft-deleted recipients are filtered at read time (FR-017).

### Closed enum: `NotificationType`

```python
class NotificationType(str, Enum):
    ASSIGNMENT = "assignment"
    PAYMENT = "payment"
    PAYMENT_PAID = "payment_paid"
    DEADLINE = "deadline"
    SYSTEM = "system"
```

Stored as the string value. The service layer's `publish` function rejects any value outside this enum with `InvalidNotificationType` → HTTP 422. (FR-020.)

### Lifecycle

- **Create**: only via `notifications.service.publish` — every other write path is forbidden by audit. The function lives inside the caller's transaction (FR-013).
- **Update**: only via `notifications.service.mark_read` — sets `is_read = true` and `read_at = func.now()` once, then refuses further modification. Idempotent on subsequent calls.
- **Delete**: not supported in this iteration. Audit script rejects `session.delete(` and `session.merge(` inside `notifications/**`.

## DTO shapes (Pydantic v2, `extra="forbid"`, `from_attributes=True`)

### Outbound (HTTP response)

#### `NotificationRead` — single row in the feed

```text
{
  "id": int,
  "title": str,                 # ≤120
  "message": str,               # ≤2000
  "type": NotificationType,     # one of the enum strings
  "is_read": bool,
  "read_at": datetime | null,
  "created_at": datetime
}
```

Note: `user_id` is **not** included on outbound — the feed only ever returns rows for the caller, so the field is implicit.

#### `NotificationFeed` — envelope returned by `GET /notifications`

```text
{
  "items": NotificationRead[],
  "unread_count": int,          # caller's total unread count, not page-scoped
  "total": int,                 # caller's total notification count, not page-scoped
  "limit": int,                 # echo of request limit
  "offset": int                 # echo of request offset
}
```

#### `BroadcastResult` — envelope returned by `POST /notifications/send`

```text
{
  "created": int,               # number of rows inserted by the broadcast
  "type": NotificationType,
  "recipients_resolved": int    # number of unique users targeted before fan-out
}
```

#### `ScanResult` — envelope returned by `POST /notifications/scan-deadlines`

```text
{
  "scanned_projects": int,
  "emitted": int,               # newly created rows (excludes deduped)
  "deduped": int,               # rows that would have been duplicates of an existing key
  "as_of": date                 # server's calendar date used for dedup
}
```

### Inbound (HTTP request)

#### `BroadcastRequest` — `POST /notifications/send`

```text
{
  "recipients": {
    "all": bool,                # OR
    "role": "admin" | "manager" | "developer",   # OR
    "user_ids": int[]
  },
  "title": str,                 # 1..120
  "message": str,               # 1..2000
  "type": NotificationType | null,   # default "system"
  "email_channel": bool         # default false; if true and SMTP enabled, fan out via background task
}
```

Validation (service-side, post-Pydantic):

- Exactly one of `{ all, role, user_ids }` MUST be supplied. Zero or two-or-more → 422 (FR-018).
- For `user_ids`: every id MUST resolve to an active user. Any invalid id → reject the entire request with 422 listing the bad ids (FR-019).
- For `role`: resolves to all active users with that role at the moment of the call.
- For `all`: resolves to all active users.

#### `MarkReadResponse` — `PATCH /notifications/{id}/read`

```text
{
  "id": int,
  "is_read": true,
  "read_at": datetime
}
```

Returns 200 on first call (sets `read_at = now`) and on subsequent calls (returns the original `read_at`). Returns 404 when the id does not exist OR belongs to another user (FR-005 — privacy via deliberate conflation).

### Internal (cross-module, never on HTTP)

#### `PublishRequest` — what `notifications.service.publish` accepts

```text
publish(
  session: Session,
  *,
  recipient_id: int,
  title: str,
  message: str,
  type: NotificationType,
  dedup_key: str | None = None,
  email_channel: bool = False
) -> Notification
```

Raises:

- `InvalidNotificationType` if `type` not in enum.
- `InvalidNotificationContent` if title/message bounds violated or whitespace-only.
- `RecipientNotFound` if `recipient_id` does not match any user.
- `RecipientInactive` if the user exists but `is_active = false`.

Routes layer maps all four to HTTP 422.

The publish function uses the **caller's session** — it does not commit, it does not roll back, it does not catch. Transactional binding is the caller's responsibility (FR-013). When the upstream service rolls back, the notification row is rolled back with it. When the upstream service commits, the notification is durable.

## Migration plan

One alembic revision (`20260510_create_notifications_table`):

- Creates `notifications` table with the columns above.
- Adds `ix_notifications_user_created` (composite, descending on `created_at`).
- Adds `uq_notifications_user_dedup` partial unique on `(user_id, dedup_key)` with `postgresql_where=text('dedup_key IS NOT NULL')`. SQLite path emits a plain unique index — NULL is distinct, which preserves the desired behavior.
- Adds the two `CHECK` constraints on length.
- `down_revision` references the latest existing revision (the payments table create).

No other tables are modified.

## Backward / forward compatibility

- **Adding a new type** (e.g., `comment_mention`): no migration needed — `NotificationType` is a code-side enum and the column is `VARCHAR(32)`. Just extend the enum.
- **Renaming a type**: requires a data backfill (`UPDATE notifications SET type = 'new' WHERE type = 'old'`) — manageable.
- **Removing a type**: deferred enum sunset; old rows continue to render with the old string. Code defends with a default.
- **Adding `template_id` / `template_args` for i18n later**: additive migration, nullable columns. Existing rows continue to render the prerendered `title` / `message`. Not a v1 concern.
