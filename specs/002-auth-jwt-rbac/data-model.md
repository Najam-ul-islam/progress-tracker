# Phase 1 Data Model — Authentication (JWT + RBAC)

**Feature**: `002-auth-jwt-rbac`
**Date**: 2026-05-02
**Branch**: `002-auth-jwt-rbac`
**Source spec**: `specs/002-auth-jwt-rbac/spec.md`

This document captures the persistent and transient entities introduced by this feature, their
fields, validation rules, and relationships. The User table is owned by the `users` module per
FR-016; the `auth` module consumes it.

---

## 1. Entity: `User` (persistent — owned by `users` module)

**SQLModel table name**: `user`
**Module path**: `app/modules/users/model.py`
**Source of truth for**: identity, credentials, role assignment.

### 1.1 Fields

| Field           | Type                                       | DB constraints                                           | Pydantic validation                                                                                                          |
| --------------- | ------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`            | `int`                                      | PRIMARY KEY, AUTOINCREMENT                               | Auto-assigned; never accepted from client                                                                                    |
| `name`          | `str`                                      | NOT NULL                                                 | `min_length=1`, `max_length=120`, `strip()` whitespace                                                                       |
| `email`         | `str`                                      | NOT NULL, UNIQUE, INDEX (`ix_user_email`)                | `EmailStr`, `to_lower()` + `strip()` before persistence (FR-004)                                                             |
| `password_hash` | `str`                                      | NOT NULL                                                 | Always a bcrypt digest (`$2b$…`); never the plaintext (FR-002, FR-019)                                                       |
| `role`          | `str` (constrained to `UserRole` literal)  | NOT NULL, CHECK (`role IN ('admin','manager','developer')`) | `Literal["admin","manager","developer"]` at the schema layer (FR-005)                                                        |
| `created_at`    | `datetime`                                 | NOT NULL, DEFAULT `now()` (UTC), `default_factory` on the SQLModel side as a fallback | Server-side; not accepted from clients                                                                                       |

### 1.2 Indexes

- `pk_user` — primary key on `id` (default).
- `ix_user_email` — UNIQUE INDEX on `email`. Backs the duplicate-email check (FR-003) and
  accelerates `get_user_by_email`.

### 1.3 Identifier choice

- **Decision**: integer auto-increment `id`. Encoded as a string in the JWT `sub` claim per
  RFC 7519 (which requires `sub` to be a string).
- **Rationale**: the spec says "primary key (UUID or auto-increment integer; deferred to
  data-model phase)". Integer keys keep migrations simple, are smaller in tokens, and match the
  pattern other modules will inherit. UUIDs can be revisited if the system later needs
  client-mintable IDs.

### 1.4 Validation rules (from spec)

- **FR-002**: `password_hash` is set by `app.core.security.hash_password`; the service rejects
  any path that would persist plaintext. Tests assert the stored value starts with `$2b$`.
- **FR-003**: email uniqueness enforced both by a service-level pre-check (so the response is
  HTTP 409, not HTTP 500 from a `IntegrityError`) and by the DB unique constraint (so a
  concurrent race still cannot insert duplicates). The race winner inserts; the loser catches
  `IntegrityError` and re-raises as a 409.
- **FR-004**: email is normalised to `email.strip().lower()` at the schema layer (`UserCreate`,
  `UserLogin`) so all DB writes and lookups are canonical.
- **FR-005**: `role` value outside `{admin, manager, developer}` fails Pydantic before the
  service runs → HTTP 422.

### 1.5 State transitions

The `User` row has no formal state machine in this feature. Possible future states (suspended,
deleted, etc.) are out of scope. Soft-delete is **not** implemented; if a row is removed, any
JWT bearing its `id` becomes invalid (FR-021 — `get_current_user` returns 401 when the DB lookup
fails).

### 1.6 Relationships

- This feature creates no foreign keys. Other modules (`projects`, `clients`, etc.) will later
  declare FKs to `user.id`.

---

## 2. Entity: `AccessToken` (transient — never persisted)

**Module path**: `app/core/security.py` (encode/decode); produced by `app/modules/auth/service.py`.

A signed JWT issued at login. Not stored anywhere on the server side; the client holds it.

### 2.1 Header

```json
{ "alg": "HS256", "typ": "JWT" }
```

### 2.2 Payload claims

| Claim   | Type   | Source                                                                                            | Notes                                                                                                                                  |
| ------- | ------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `sub`   | string | `str(user.id)`                                                                                    | RFC 7519 subject. Decoded back to `int(sub)` in `get_current_user`.                                                                    |
| `email` | string | `user.email` (already lowercased)                                                                 | Convenience for downstream logging; not the primary identifier.                                                                        |
| `role`  | string | `user.role`                                                                                       | One of `admin`, `manager`, `developer`. Read by role-guard dependencies (FR-014).                                                      |
| `iat`   | int    | `int(datetime.now(UTC).timestamp())`                                                              | Issued-at — supports rotation/audit reasoning.                                                                                         |
| `exp`   | int    | `iat + JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60`                                                      | Strict expiration check (no leeway). After this moment the token is rejected with HTTP 401 (FR-009, FR-012).                            |

### 2.3 Signing

- **Algorithm**: HS256.
- **Key**: `Settings.JWT_SECRET_KEY` — required, no default. Missing key ⇒ process refuses to
  start (FR-010, R5).
- **Encoded form**: `Authorization: Bearer <token>` on every protected request.

### 2.4 Failure modes (all → HTTP 401, generic body — FR-007, FR-012, FR-015)

- Header missing.
- Token signature does not verify against `JWT_SECRET_KEY`.
- Token is structurally invalid (not three base64url segments, not parseable JSON).
- `exp` claim is in the past.
- `sub` claim parses to an `id` that no longer exists in the `user` table (FR-021).

---

## 3. Schema-level value objects (Pydantic v2)

These live in `app/modules/auth/schema.py` and shape the HTTP boundary. They are **not**
persistent entities, but they constrain what the service accepts and returns.

### 3.1 `UserCreate` — request body for `POST /auth/register`

```python
class UserCreate(BaseModel):
    name: str                       # min_length=1, max_length=120, stripped
    email: EmailStr                 # lowercased+stripped via field_validator
    password: str                   # min_length=8, max_length=128
    role: Literal["admin", "manager", "developer"]
    model_config = ConfigDict(extra="ignore")
```

### 3.2 `UserLogin` — request body for `POST /auth/login`

```python
class UserLogin(BaseModel):
    email: EmailStr                 # lowercased+stripped via field_validator
    password: str                   # min_length=1, max_length=128
    model_config = ConfigDict(extra="ignore")
```

### 3.3 `UserRead` — response shape for register, login.user, and `GET /auth/me`

```python
class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: Literal["admin", "manager", "developer"]
    created_at: datetime           # only on register; omitted-or-kept on /me at impl. time
    model_config = ConfigDict(from_attributes=True)
```

`password_hash` is **never** serialised into `UserRead`; SC-002 / FR-019 are enforced by
omission, not by post-hoc filtering.

### 3.4 `TokenResponse` — response body for `POST /auth/login`

```python
class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead
```

### 3.5 `AuthError` — generic 401 / 403 body

```python
class AuthError(BaseModel):
    detail: str   # always one of: "Could not validate credentials" | "Forbidden"
```

This shape is the canonical generic body for FR-007 and FR-015.

---

## 4. Migration plan (alembic)

Single revision `20260502_create_user_table.py`:

- `create_table('user', …)` with the columns from §1.1.
- `create_index('ix_user_email', 'user', ['email'], unique=True)`.
- Down-revision: drop the index, then the table.

No data migration is needed — this is a greenfield table.

---

## 5. Cross-references to spec

| Spec ID | Fulfilled by                                                            |
| ------- | ----------------------------------------------------------------------- |
| FR-001  | `UserCreate` + `UserRead` shapes                                        |
| FR-002  | `password_hash` field; service hashes via `core.security.hash_password` |
| FR-003  | UNIQUE INDEX on `email` + service pre-check                             |
| FR-004  | `field_validator` lowercases email at schema boundary                   |
| FR-005  | `Literal["admin","manager","developer"]` on schema; CHECK in DB         |
| FR-008  | `AccessToken` claim list                                                |
| FR-009  | `exp` derivation from `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`                 |
| FR-010  | `Settings.JWT_SECRET_KEY` has no default ⇒ boot fails without it        |
| FR-019  | `UserRead` does not include `password_hash`                             |
| FR-020  | `role` claim minted from the user's stored role                         |
| FR-021  | `get_current_user` re-validates `sub` exists in DB                      |
