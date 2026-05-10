# Quickstart: Notifications

**Feature**: 008-notifications
**Date**: 2026-05-09

End-to-end walk-through of the notifications surface using `curl`. Assumes the
backend is running at `http://localhost:8000` and the auth feature (002) is
configured. Run `uv run uvicorn app.main:app --reload` from `backend/`.

## 0. Sign in (admin + developer)

```sh
ADMIN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq -r .access_token)

DEV=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"dev1@example.com","password":"dev123"}' | jq -r .access_token)
```

## 1. Empty feed for a fresh user

```sh
curl -s http://localhost:8000/notifications \
  -H "authorization: Bearer $DEV" | jq
```

Expected:

```json
{ "items": [], "unread_count": 0, "total": 0, "limit": 50, "offset": 0 }
```

## 2. Admin broadcasts a system message to all developers

```sh
curl -s -X POST http://localhost:8000/notifications/send \
  -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' \
  -d '{
        "recipients": { "role": "developer" },
        "title": "Quarterly survey is open",
        "message": "Please fill out the engineering survey by Friday.",
        "type": "system"
      }' | jq
```

Expected:

```json
{ "created": 3, "type": "system", "recipients_resolved": 3 }
```

(`created` and `recipients_resolved` equal the count of active developers.)

## 3. Developer sees the broadcast in their feed

```sh
curl -s http://localhost:8000/notifications \
  -H "authorization: Bearer $DEV" | jq '.items[0]'
```

Expected:

```json
{
  "id": 1,
  "title": "Quarterly survey is open",
  "message": "Please fill out the engineering survey by Friday.",
  "type": "system",
  "is_read": false,
  "read_at": null,
  "created_at": "2026-05-09T18:24:01.123Z"
}
```

`unread_count` in the envelope is `1`.

## 4. Mark the notification read

```sh
curl -s -X PATCH http://localhost:8000/notifications/1/read \
  -H "authorization: Bearer $DEV" | jq
```

Expected:

```json
{ "id": 1, "is_read": true, "read_at": "2026-05-09T18:24:35.456Z" }
```

Re-running the same PATCH returns 200 with the **same** `read_at` (idempotent —
first read wins). Subsequent `GET /notifications` shows `unread_count: 0` and the
row's `is_read` is `true`.

## 5. Cross-user PATCH returns 404, not 403 (FR-005)

Try as developer A to mark another user's notification (`id=99`):

```sh
curl -i -X PATCH http://localhost:8000/notifications/99/read \
  -H "authorization: Bearer $DEV"
```

Expected: `404 Not Found`. Existence of notification 99 is not leaked.

## 6. Producer hook — assignment auto-emits a notification

When admin assigns a developer to a project module via the existing projects flow:

```sh
curl -s -X POST http://localhost:8000/projects/<project_id>/modules/<module_id>/assign \
  -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' \
  -d '{"developer_id": <dev_id>}'
```

The developer's feed gains a new row with `type: "assignment"` in the same
transaction. No extra API call is needed.

```sh
curl -s http://localhost:8000/notifications \
  -H "authorization: Bearer $DEV" | jq '.items[0] | {type, title}'
```

Expected:

```json
{ "type": "assignment", "title": "You have been assigned to <module name>" }
```

## 7. Admin runs the deadline scan (idempotent per day)

```sh
curl -s -X POST http://localhost:8000/notifications/scan-deadlines \
  -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' \
  -d '{"lookahead_days": 3}' | jq
```

Expected (first call of the day):

```json
{ "scanned_projects": 5, "emitted": 4, "deduped": 0, "as_of": "2026-05-09" }
```

Re-running the same scan on the same calendar day:

```json
{ "scanned_projects": 5, "emitted": 0, "deduped": 4, "as_of": "2026-05-09" }
```

The unique partial index on `(user_id, dedup_key)` ensures dedup at the storage
layer.

## 8. Manager attempts a broadcast → 403

```sh
MANAGER=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"manager@example.com","password":"manager123"}' | jq -r .access_token)

curl -i -X POST http://localhost:8000/notifications/send \
  -H "authorization: Bearer $MANAGER" \
  -H 'content-type: application/json' \
  -d '{"recipients":{"all":true},"title":"x","message":"y"}'
```

Expected: `403 Forbidden`. Only admins may broadcast.

## 9. Validation failures are 422

| Bad input                                              | Status | Reason |
|--------------------------------------------------------|--------|--------|
| `recipients` missing entirely                          | 422    | At least one selector required (FR-018) |
| `recipients = {"all": true, "role": "developer"}`      | 422    | Exactly one of `{all, role, user_ids}` |
| `recipients = {"user_ids": [4, 999]}` and 999 missing  | 422    | All-or-nothing (FR-019) — body lists invalid ids |
| `type = "broken"`                                      | 422    | Closed enum (FR-020) |
| `title = ""` or `message = ""`                          | 422    | Length bounds (FR-021) |
| `limit = 500`                                          | 422    | Pagination cap (Decision 9) |

## 10. Email channel (when SMTP enabled)

If `NOTIFICATIONS_SMTP_ENABLED=true` and SMTP config is set:

- Every `assignment` / `payment_paid` / `deadline` notification is **also**
  dispatched as an email to the recipient's `User.email` address via a
  FastAPI `BackgroundTasks` job — fired after the API response is sent.
- Broadcast emails are opt-in: the broadcast request must include
  `"email_channel": true` to fan out via email.
- SMTP failures are logged and **never** raised to the API caller. The in-app
  row is unaffected.

If the flag is off (default), the channel is a no-op and the in-app feed is the
only delivery surface.
