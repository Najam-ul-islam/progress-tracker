# Quickstart — Authentication (JWT + RBAC)

**Feature**: `002-auth-jwt-rbac`
**Audience**: developer running the backend locally for the first time after this feature lands.
**Prereqs**: Python ≥ 3.13, `uv` installed, Postgres reachable at `DATABASE_URL`.

This guide is a smoke test: it walks the register → login → `/auth/me` flow end-to-end. It maps
1:1 to the spec's User Stories and Success Criteria.

---

## 1. Install / sync dependencies

All of the auth-feature deps already live in `backend/pyproject.toml` (`fastapi`, `sqlmodel`,
`python-jose[cryptography]`, `passlib[bcrypt]`).

```bash
cd backend
uv sync
```

If anything was added by this feature, also run:

```bash
uv add <pkg>           # only if a missing dep is detected during work
```

> **Project rule**: this repo uses **uv only**. Never use `pip`, `python -m venv`, or manual
> virtualenv creation.

---

## 2. Environment

Create `backend/.env` with at least:

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/progress_tracker
JWT_SECRET_KEY=replace-with-a-long-random-string
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
ENVIRONMENT=development
```

The app **refuses to start** if `JWT_SECRET_KEY` is missing or empty (FR-010).

---

## 3. Run the migration

```bash
cd backend
uv run alembic upgrade head
```

This creates the `user` table with a UNIQUE INDEX on `email`.

---

## 4. Boot the API

```bash
cd backend
uv run uvicorn app.main:app --reload
```

Open <http://localhost:8000/docs> — Swagger UI shows `POST /auth/register`, `POST /auth/login`,
and `GET /auth/me`.

---

## 5. Smoke flow — User Stories US1 → US2 → US3

### 5.1 Register (US1)

```bash
curl -X POST http://localhost:8000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Ada Lovelace",
    "email": "Ada@Example.com",
    "password": "first-program-1843",
    "role": "admin"
  }'
```

Expected: HTTP 201, body shape `{id, name, email:"ada@example.com", role:"admin", created_at}`.
Email was lowercased server-side (FR-004). Body MUST NOT contain `password_hash` (FR-019).

Re-running the same call returns HTTP 409 (`Email already registered` — FR-003).

### 5.2 Login (US2)

```bash
curl -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{ "email": "ada@example.com", "password": "first-program-1843" }'
```

Expected: HTTP 200 with `{access_token, token_type:"bearer", user:{…}}`.

Bad password OR unknown email → HTTP 401 with **identical** body
`{"detail": "Could not validate credentials"}` (FR-007, SC-005).

### 5.3 Read current user (US3)

```bash
TOKEN="<paste access_token>"
curl http://localhost:8000/auth/me -H "Authorization: Bearer $TOKEN"
```

Expected: HTTP 200, same `UserRead` shape.

No header, malformed token, expired token, or token signed with a different secret → HTTP 401
generic body.

---

## 6. Inspect a JWT (sanity check)

```bash
python - <<'PY'
import os, json, base64
tok = os.environ["TOKEN"]
header_b64, payload_b64, sig_b64 = tok.split(".")
def pad(s): return s + "=" * (-len(s) % 4)
print(json.loads(base64.urlsafe_b64decode(pad(payload_b64))))
PY
```

Expected payload contains `sub`, `email`, `role`, `iat`, `exp` (FR-008).

---

## 7. Role-guard quick check (US4)

After this feature is merged, any other route can be guarded:

```python
from fastapi import APIRouter, Depends
from app.modules.auth.dependencies import require_admin
from app.modules.users.model import User

router = APIRouter()

@router.delete("/admin-only", tags=["demo"])
def hello(user: User = Depends(require_admin)):
    return {"hello": user.email}
```

- Token with `role="admin"` → 200.
- Token with `role="developer"` → 403, body `{"detail": "Forbidden"}`.

---

## 8. Run the test suite

```bash
cd backend
uv run pytest -q
```

The suite covers:

- US1 acceptance scenarios (register success, duplicate email, bad role, missing fields).
- US2 acceptance scenarios (good credentials, wrong password, unknown email, exp shape).
- US3 acceptance scenarios (valid token, missing header, garbage token).
- US4 acceptance scenarios (require_admin allow/deny, require_any combos).
- The greppable assertion that `password_hash` never appears in any HTTP response (SC-002).

---

## 9. Troubleshooting

| Symptom                                              | Likely cause                                      | Fix                                                      |
| ---------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| App crashes on boot with `ValidationError`           | `JWT_SECRET_KEY` missing in `.env`                | Set it. (Spec FR-010 says boot MUST fail without it.)    |
| `alembic upgrade head` fails with "no script_location"| Running from the repo root, not from `backend/`   | `cd backend` first                                       |
| Login returns 422 with `value_error.email`           | The `email` field isn't a valid email format      | Send a real RFC-5321 address                             |
| `/auth/me` returns 401 right after a successful login | Server time skewed > token TTL, or wrong secret   | Sync clock; confirm `JWT_SECRET_KEY` matches what minted |
