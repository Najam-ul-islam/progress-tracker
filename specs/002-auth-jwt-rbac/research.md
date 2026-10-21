# Phase 0 Research — Authentication (JWT + RBAC)

**Feature**: `002-auth-jwt-rbac`
**Date**: 2026-05-02
**Branch**: `002-auth-jwt-rbac`

This document resolves every NEEDS CLARIFICATION raised in `plan.md` Technical Context and records
the rationale for each choice that survived. The format per item is **Decision / Rationale /
Alternatives considered**, as required by the plan workflow.

---

## R1. Password hashing algorithm

- **Decision**: Use `passlib[bcrypt]` with the default 12-round work factor; expose
  `hash_password()` / `verify_password()` from `app/core/security.py`.
- **Rationale**:
  - `passlib[bcrypt]` is already a declared dependency in `backend/pyproject.toml` and is the
    explicit ask in the user's plan input ("bcrypt password hashing").
  - Bcrypt is battle-tested, has a built-in salt and tunable cost, and is the de-facto industry
    default for password storage in services that don't have a hardware-backed KMS.
  - 12 rounds gives ~250 ms per hash on commodity hardware in 2026 — fast enough not to block
    request handlers, slow enough to make offline cracking expensive.
- **Alternatives considered**:
  - `argon2-cffi` (also already a project dependency). Stronger memory-hardness guarantees, but
    the spec explicitly mandates bcrypt and the test suite will check that the hash prefix is
    `$2b$…`. Keeping argon2 in the lockfile is harmless; it can become the migration target
    later behind a `passlib.CryptContext` with `deprecated="auto"`.
  - Plain SHA-256 / SHA-512 with manual salt: rejected — does not have a tunable cost factor and
    has well-known GPU-cracking properties.

## R2. JWT library and signing algorithm

- **Decision**: Use `python-jose[cryptography]` with **HS256** signing. `JWT_SECRET_KEY`,
  `JWT_ALGORITHM` (default `"HS256"`), and `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default 60) are
  all loaded by `app/core/config.py::Settings`.
- **Rationale**:
  - `python-jose[cryptography]` is already a declared dependency.
  - Per spec assumption: "HS256 is acceptable because the API is the only token verifier."
    Symmetric signing keeps deployment simple — one secret, one verifier.
  - Spec's FR-008 explicitly demands HS256.
- **Alternatives considered**:
  - **PyJWT**: simpler API, but switching adds a dependency for no functional gain.
  - **RS256 / EdDSA**: needed only when a third-party verifier exists; spec lists this as out of
    scope.

## R3. JWT claims shape

- **Decision**: Mint tokens with the following claim set:
  ```json
  {
    "sub": "<user_id_as_string>",
    "email": "<lowercased>",
    "role": "admin|manager|developer",
    "iat": <unix_ts>,
    "exp": <iat + JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60>
  }
  ```
- **Rationale**:
  - `sub` (RFC 7519) is the canonical "subject" claim and is required by FR-008.
  - Embedding `role` in the token (FR-020) lets downstream guards run in O(1) without re-hitting
    the DB for the common path. A delete-while-logged-in is caught at `get_current_user`'s
    DB lookup (FR-021).
  - `email` is included so audit logs and downstream services can label requests without
    re-fetching.
- **Alternatives considered**:
  - Putting `user_id` as the bare top-level claim (not under `sub`): rejected, breaks RFC 7519
    interoperability and the spec's explicit list of required claims.
  - Storing role list (multi-role): rejected per assumption "single role per user is sufficient".

## R4. Token expiration default

- **Decision**: Default `JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60`. Override per environment via
  `.env`. The current `Settings` default is 30; this plan raises it to 60 to match the user's
  plan input ("default 60, configurable per environment") and aligns `Settings` with the spec.
- **Rationale**: 60 minutes is a common compromise between UX (don't make users re-login mid-task)
  and risk (stolen-token blast radius capped at one hour, since refresh tokens are out of scope).
- **Alternatives considered**:
  - 15 minutes: too aggressive without refresh tokens.
  - 24 hours: too long for a token with no revocation list.

## R5. JWT-secret startup hard-fail

- **Decision**: `Settings` already requires `JWT_SECRET_KEY` (no default), so `get_settings()`
  raises `pydantic_core.ValidationError` on import if the env var is missing or empty. We will
  add an explicit eager `get_settings()` call at FastAPI startup so the failure surface is the
  process boot, not the first request that touches `core/security`.
- **Rationale**: Spec FR-010 mandates "MUST refuse to start if `JWT_SECRET_KEY` is missing or
  empty." Eagerly resolving settings in `app.main` makes the failure deterministic and visible
  in CI/CD before the first request.
- **Alternatives considered**:
  - Defer to lazy init at first JWT call: rejected — the failure would surface as an HTTP 500
    on first request rather than a boot-time crash, which violates the spec's "refuse to start"
    intent.

## R6. Email normalisation

- **Decision**: At the schema layer (Pydantic v2 `EmailStr` + a `field_validator` on
  `UserCreate.email` and `UserLogin.email`) lowercase and strip the email **before** it reaches
  the service. The DB unique constraint is on the stored (already-lowercased) value.
- **Rationale**: Spec FR-004 + edge case "Foo@Bar.com → stored and looked up case-insensitively".
  Doing the normalisation at the schema boundary means the service and repository can treat the
  email as canonical and the unique constraint is meaningful.
- **Alternatives considered**:
  - Citext column / functional index on `lower(email)` at the DB level: more bulletproof but
    couples the auth feature to a specific Postgres extension; current SQLModel surface and the
    SQLite fallback used in tests do not support citext uniformly.

## R7. Generic auth-failure error shape

- **Decision**: Every authentication / token-validation failure raises
  `HTTPException(status_code=401, detail="Could not validate credentials")` with header
  `WWW-Authenticate: Bearer`. Login failures use the same `401` and same generic detail text.
- **Rationale**:
  - Spec FR-007, FR-015, SC-005: byte-identical responses for "wrong email" and "wrong password".
  - Including `WWW-Authenticate: Bearer` follows RFC 6750 §3 and lets HTTP clients surface a
    sensible challenge.
- **Alternatives considered**:
  - `403 Forbidden` for wrong password: rejected — semantically wrong (403 = "I know who you are
    and you are not allowed"); `401` matches the spec.

## R8. Role enumeration & 422 vs 400

- **Decision**: Define `UserRole = Literal["admin", "manager", "developer"]` (Pydantic v2) on the
  schema; SQLModel column is `str` with a check-constraint mirroring the same set. Invalid roles
  fail Pydantic validation → HTTP 422 (FastAPI default).
- **Rationale**: FR-005 requires HTTP 422 at the schema layer, before the service runs. A
  `Literal` type is the cleanest Pydantic v2 pattern; `Enum` would also work but `Literal` keeps
  the JSON output as plain strings without an `Enum.value` dance.
- **Alternatives considered**:
  - Python `enum.Enum`: equivalent behaviour, slightly more ceremony.
  - Free-form string with service-level check: rejected — gives HTTP 400/500 from the service
    instead of 422 from the schema, contradicting FR-005.

## R9. Repository layer ownership of the User table

- **Decision**: The `User` SQLModel lives in `app/modules/users/model.py` (already exists; will
  be filled in). `app/modules/users/repository.py` exposes
  `get_user_by_email(session, email)`, `get_user_by_id(session, id)`, `create_user(session, …)`.
  `app/modules/auth/repository.py` is a thin re-export / facade that delegates into
  `users.repository`.
- **Rationale**: FR-016 mandates the User model lives in `users` and the auth module consumes it
  via the users module's repository. SC-007 mandates auth's only cross-module import is
  `app.modules.users`. The thin auth-side facade keeps service.py's import surface stable if the
  users module ever splits its repository.
- **Alternatives considered**:
  - Putting all auth-related queries in `auth/repository.py` and importing the model directly
    from users: simpler but pushes "User CRUD" away from the module that owns the entity.

## R10. Dependency-injection shape for `get_current_user`

- **Decision**: `get_current_user` in `app/modules/auth/dependencies.py` takes
  `Depends(oauth2_scheme)` (`OAuth2PasswordBearer(tokenUrl="/auth/login")`) and
  `Depends(get_session)`. Decoding goes through `app.core.security.decode_access_token`.
  Role guards are factory functions: `require_roles(*roles) -> Callable[[User], User]`, with
  thin convenience wrappers `require_admin = require_roles("admin")`, etc.
- **Rationale**:
  - Using `OAuth2PasswordBearer` makes Swagger UI's "Authorize" button work out of the box.
  - The factory pattern keeps the guard logic in one place (FR-014) and lets other modules
    declare `Depends(require_admin)` in a single line.
  - Routing through `core.security.decode_access_token` honours FR-017 (no module decodes JWTs
    directly).
- **Alternatives considered**:
  - A custom `APIKeyHeader` for the bearer token: works but breaks the OpenAPI "Authorize" UX
    in `/docs`.

## R11. Logging strategy for auth events

- **Decision**: Use the stdlib `logging` module with a logger named `app.auth`. Emit INFO on
  registration success, login success; emit WARNING on login failure and token rejection. Never
  log the password, password hash, full token, or token signature. When referencing a user, use
  `user_id` only.
- **Rationale**: FR-022 demands audit-grade events without leaking secrets. Stdlib logging is
  already the project's de-facto choice (no structlog dep declared) and routes through whatever
  formatter the deployment configures.
- **Alternatives considered**:
  - Structured-log libraries (`structlog`, `loguru`): not currently in the dependency list;
    bringing them in would expand scope beyond the auth feature.

## R12. Test stack and database-under-test

- **Decision**:
  - Test runner: `pytest` (will be added via `uv add --group dev pytest pytest-asyncio httpx`).
  - HTTP client: FastAPI's `TestClient` (sync) — auth flows are short and synchronous.
  - DB-under-test: an in-process SQLite (via SQLModel `create_engine("sqlite:///:memory:")`)
    with `metadata.create_all` on a fresh engine per test session, overriding `get_session`
    with FastAPI's `app.dependency_overrides`.
- **Rationale**: SQLite in-memory keeps the test suite hermetic and uv-runnable without a
  Postgres container, and the auth feature uses no Postgres-specific column types. The real
  Postgres instance (configured via `DATABASE_URL`) is exercised by alembic migrations and by
  the manual `quickstart.md` smoke test.
- **Alternatives considered**:
  - Spin up Postgres in CI via `testcontainers-python`: heavier and not needed for the
    primitives this feature exercises (string columns, unique index, timestamp).
  - Use the dev Postgres directly: rejected — non-hermetic; would make tests order-dependent.

## R13. Migration tool for the `user` table

- **Decision**: Use the existing alembic setup (`backend/alembic/`). Generate one revision named
  `create_user_table` with the columns from the data model, including
  `UNIQUE(email)` and `INDEX(email)`.
- **Rationale**: Alembic is already wired in `backend/alembic.ini` and is the project's chosen
  migration tool. The auth feature is the first feature to add a real table, so it owns the
  migration creation pattern others will copy.
- **Alternatives considered**:
  - `SQLModel.metadata.create_all` at app startup: fine for the SQLite test DB, but unsafe in
    production where migrations must be reviewable artifacts.

---

## Summary — every NEEDS CLARIFICATION resolved

| Area                         | Outcome                                       |
| ---------------------------- | --------------------------------------------- |
| Password hashing             | bcrypt via passlib (R1)                       |
| JWT library                  | python-jose[cryptography] HS256 (R2)          |
| JWT claims                   | sub / email / role / iat / exp (R3)           |
| Token expiry default         | 60 minutes (R4)                               |
| Missing-secret behaviour     | hard-fail at boot (R5)                        |
| Email normalisation          | lowercase + strip at schema layer (R6)        |
| Generic 401 shape            | "Could not validate credentials" (R7)         |
| Role enum                    | Literal["admin","manager","developer"] (R8)   |
| User-table ownership         | users module; auth re-exports (R9)            |
| `get_current_user` shape     | OAuth2PasswordBearer + role-factory (R10)     |
| Logging                      | stdlib logging, no secrets (R11)              |
| Test stack                   | pytest + TestClient + SQLite in-mem (R12)     |
| Migration tool               | alembic, one revision (R13)                   |

No NEEDS CLARIFICATION remain.
