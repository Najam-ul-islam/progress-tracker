# Feature Specification: Authentication (JWT + RBAC)

**Feature Branch**: `002-auth-jwt-rbac`
**Created**: 2026-05-01
**Status**: Draft
**Input**: User description (verbatim, condensed):
> MODULE: Authentication. Provide secure user authentication and authorization using JWT-based authentication with RBAC for the SaaS system. Roles: admin, manager, developer (each user has exactly one). Endpoints: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`. JWT must include user_id/email/role and expiration; bcrypt password hashing; secret from env. Depends on `users` module, `core/security`, `db/session`. Must follow the modular six-file layer structure already in place.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Register a new account (Priority: P1)

A first-time user (admin/manager/developer) opens `POST /auth/register` with their name, email, password, and role. The system creates the account, hashes the password, persists the user, and returns a sanitised user record. After this flow exists, the platform has at least one identifiable account holder, so every subsequent feature can reference an authenticated principal.

**Why this priority**: Without registration, no user exists. This is the prerequisite for every other feature in the SaaS (clients, projects, payments, reporting, notifications). It is also the smallest deployable slice that delivers visible value (a created user record).

**Independent Test**: With only US1 implemented, an integration test can `POST /auth/register` with valid input and assert HTTP 201 + a user row in the database whose `password_hash` is not the plaintext password. Login is *not* required to validate this slice.

**Acceptance Scenarios**:

1. **Given** an empty users table, **When** `POST /auth/register` is called with `{name, email, password, role:"admin"}`, **Then** the response is HTTP 201 with `{id, name, email, role, created_at}` and the stored `password_hash` is a bcrypt hash (never the plaintext).
2. **Given** an existing user with email `a@b.com`, **When** `POST /auth/register` is called again with the same email, **Then** the response is HTTP 409 (or 400 with a clear duplicate-email error) and no second row is created.
3. **Given** any registration request, **When** `role` is not one of `admin | manager | developer`, **Then** the response is HTTP 422 with a validation error and no row is created.
4. **Given** any registration request, **When** required fields (name/email/password/role) are missing or empty, **Then** the response is HTTP 422 with field-level validation errors.

---

### User Story 2 — Login and receive a JWT (Priority: P1)

A registered user submits credentials to `POST /auth/login`. On success, they receive a signed JWT bearing their identity and role plus an expiration. Clients store this token and present it on every subsequent request to protected resources.

**Why this priority**: Login is the gate that turns a stored user into an authenticated session. Until tokens are minted, no protected endpoint anywhere in the system can be reached, which makes every other module effectively dead. P1 alongside US1.

**Independent Test**: Seed one user (via direct DB insert or via US1's endpoint), call `POST /auth/login` with correct credentials, decode the returned `access_token`, and assert the payload contains `user_id`, `email`, `role`, and a future `exp` claim.

**Acceptance Scenarios**:

1. **Given** a user exists with email `m@n.com` and password `correct-horse`, **When** `POST /auth/login` is called with those exact credentials, **Then** the response is HTTP 200 with `{access_token, token_type:"bearer", user:{id,name,email,role}}` and the token decodes to a payload containing `user_id`, `email`, `role`, `exp`.
2. **Given** the same user, **When** the password supplied is wrong, **Then** the response is HTTP 401 with a generic authentication error (no field-level disclosure of which field was wrong).
3. **Given** no user with that email exists, **When** `POST /auth/login` is called, **Then** the response is HTTP 401 with the same generic authentication error as scenario 2 (no user-enumeration leak).
4. **Given** a successful login, **When** the token's `exp` claim is decoded, **Then** the expiration is in the future and matches the configured `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` window (within ±5 s).

---

### User Story 3 — Read the current user via a protected endpoint (Priority: P1)

An authenticated client presents `Authorization: Bearer <token>` on `GET /auth/me`. The system validates the token, resolves the principal, and returns the current user's record. Any downstream module that needs "the current user" reuses the same dependency.

**Why this priority**: This story proves the *consumption* side of the JWT: it shows the dependency-based auth guard works end-to-end and yields the principal that every other module will rely on (`get_current_user` is the single canonical point).

**Independent Test**: With US1 + US2 done, an integration test logs in, takes the returned token, and calls `GET /auth/me` with the `Authorization: Bearer …` header. The response must be the same `user` shape that login returned, derived solely from the token + DB lookup.

**Acceptance Scenarios**:

1. **Given** a valid bearer token issued in the last minute, **When** `GET /auth/me` is called with `Authorization: Bearer <token>`, **Then** the response is HTTP 200 with `{id, name, email, role}` matching the user the token was issued for.
2. **Given** a request with no `Authorization` header, **When** `GET /auth/me` is called, **Then** the response is HTTP 401.
3. **Given** a request whose token is structurally invalid, expired, or signed with the wrong secret, **When** `GET /auth/me` is called, **Then** the response is HTTP 401 with a generic message (no leaking which check failed).

---

### User Story 4 — Role-based access enforcement (Priority: P2)

Other modules must be able to declare "this endpoint requires role X" with a one-line dependency. The auth module exposes role-guard dependency factories (`require_admin`, `require_manager`, `require_developer`, plus `require_any(*roles)`) that mount on top of `get_current_user` and reject mismatched principals with HTTP 403.

**Why this priority**: P2, not P1, because the platform can ship MVP-level value once US1–US3 exist (any logged-in user can use the system). Per-endpoint role enforcement becomes critical the moment a second module exposes admin-only operations, which is the next feature to be built but not part of this slice's MVP.

**Independent Test**: Register an `admin` and a `developer`. Mount a temporary test route that depends on `require_admin`. Call it with each token; assert 200 for admin and 403 for developer. The route does not need to do real work — the dependency's behaviour is the test.

**Acceptance Scenarios**:

1. **Given** an endpoint protected by `require_admin`, **When** a token whose role claim is `admin` is presented, **Then** the response is the route's normal HTTP 200/2xx.
2. **Given** the same endpoint, **When** a token whose role claim is `developer` is presented, **Then** the response is HTTP 403 with a generic forbidden error.
3. **Given** a `require_any("admin","manager")` guard, **When** a `manager` token is presented, **Then** access is granted; **when** a `developer` token is presented, access is denied with HTTP 403.

---

### Edge Cases

- Token is well-formed but its `user_id` no longer exists in the database (user was deleted) → HTTP 401 (token without principal is not a session).
- Token is expired by 1 second → HTTP 401, same generic error as any other invalid token.
- Registration request includes extra unknown fields → fields are silently dropped (Pydantic `extra="ignore"`); request still validates.
- Email is provided in mixed case (`Foo@Bar.com`) → stored and looked up in a case-insensitive way (lowercased on write & read) so the unique constraint is meaningful.
- Server clock skew: token's `exp` is checked with no leeway (strict). Clients must refresh proactively.
- `JWT_SECRET_KEY` env var is missing at startup → app refuses to boot rather than starting with an insecure default.
- Two concurrent registrations race on the same email → DB unique constraint wins; second request gets HTTP 409, not HTTP 500.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose `POST /auth/register` accepting `{name: str, email: str, password: str, role: "admin"|"manager"|"developer"}` and returning `{id, name, email, role, created_at}` on HTTP 201.
- **FR-002**: The system MUST hash passwords with bcrypt before persistence; plaintext passwords MUST never be written to the database, logged, or echoed in any response.
- **FR-003**: The system MUST enforce email uniqueness via a database-level unique constraint AND a service-level pre-check that returns HTTP 409 on collision.
- **FR-004**: The system MUST normalise email to lowercase before storage and lookup so case-variants do not bypass the unique constraint.
- **FR-005**: The system MUST reject any role value outside `{admin, manager, developer}` with HTTP 422 at the schema layer (Pydantic enum), before the service is invoked.
- **FR-006**: The system MUST expose `POST /auth/login` accepting `{email, password}` and returning `{access_token, token_type:"bearer", user:{id, name, email, role}}` on HTTP 200.
- **FR-007**: The system MUST return a generic HTTP 401 on login failure regardless of whether the email is unknown or the password is wrong (no user enumeration).
- **FR-008**: The JWT MUST include claims `sub` (user id as string), `email`, `role`, `iat` (issued-at), and `exp` (expiration). It MUST be signed with HS256 using the `JWT_SECRET_KEY` env var.
- **FR-009**: The JWT expiration MUST be `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` minutes after issuance (default 60, configurable per environment).
- **FR-010**: The system MUST refuse to start if `JWT_SECRET_KEY` is missing or empty.
- **FR-011**: The system MUST expose `GET /auth/me` returning the current user's `{id, name, email, role}` for any caller presenting a valid `Authorization: Bearer <token>` header.
- **FR-012**: The system MUST validate the bearer token on every protected request: signature, expiration, structural correctness. Any failure yields HTTP 401 with a generic message.
- **FR-013**: The auth module MUST expose a `get_current_user` dependency (via `dependencies.py`) that other modules import as their canonical "who is calling" hook. No other module may decode the JWT directly.
- **FR-014**: The auth module MUST expose role-guard dependency factories `require_admin`, `require_manager`, `require_developer`, and `require_any(*roles)` that build on `get_current_user` and yield HTTP 403 on role mismatch.
- **FR-015**: All authentication failures (invalid credentials, invalid/expired token, missing token) MUST share a single generic error shape so that responses do not disclose which check failed.
- **FR-016**: The User model MUST live in the `users` module; the auth module MUST consume it via the users module's repository (no direct table access from auth/repository.py).
- **FR-017**: All JWT encoding/decoding logic MUST live in `app/core/security.py`. The auth module's `service.py` calls those helpers but never imports `python-jose` directly.
- **FR-018**: All database I/O for auth MUST go through `app/modules/auth/repository.py` (sessions injected via `app.db.session.get_session`). Routes MUST NOT import the session.
- **FR-019**: Registration responses MUST NOT include `password_hash`; login responses MUST NOT include `password_hash`; `GET /auth/me` MUST NOT include `password_hash`. The hash MUST never appear in any output schema.
- **FR-020**: The role claim in the JWT MUST be the same string the user was registered with; modules consuming the token MUST treat the role as the source of truth (not re-fetch from DB on every request unless they need the freshest value).
- **FR-021**: A user whose `id` from the token no longer exists in the database MUST receive HTTP 401 on protected endpoints (deleted-while-logged-in case).
- **FR-022**: The system MUST log authentication events (registration created, login success, login failure, token rejected) with sufficient context to support audit, but MUST NOT log passwords, password hashes, or full tokens.

### Key Entities

- **User** (owned by the `users` module; consumed by `auth`):
  - `id` — primary key (UUID or auto-increment integer; deferred to data-model phase)
  - `name` — display name
  - `email` — unique, indexed, lowercased on write
  - `password_hash` — bcrypt digest
  - `role` — enum `admin | manager | developer`
  - `created_at` — UTC timestamp set at insert time
- **AccessToken** (transient; not persisted):
  - JWT carrying `sub`, `email`, `role`, `iat`, `exp` claims, signed HS256

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete the register → login → call `GET /auth/me` flow in under 1 second wall-time on a developer machine, demonstrating that the auth path is not a performance bottleneck.
- **SC-002**: Zero plaintext passwords appear anywhere in the database, logs, or HTTP responses across the full integration test suite (verified by greppable assertion).
- **SC-003**: 100 % of protected endpoints reject (HTTP 401) every request lacking a valid bearer token; verified by a generic "no auth header → 401" sweep across every router.
- **SC-004**: 100 % of role-guarded endpoints reject (HTTP 403) every request whose token role does not match the guard's allowed set; verified by a per-route role-matrix test.
- **SC-005**: Login failure responses for "unknown email" and "wrong password" are byte-identical (excluding timing); a black-box observer cannot infer whether an account exists.
- **SC-006**: The auth module contains zero direct imports of `python-jose`; all JWT calls funnel through `app.core.security`. Verified by a one-line grep audit.
- **SC-007**: The auth module contains zero direct imports of any other module under `app.modules.*` except `app.modules.users`; verified by the existing cross-module-import audit from the project-structure feature.

## Assumptions

- The `users` module owns the `User` SQLModel and its repository. Auth consumes it. Auth's own `model.py` may remain empty (or define small auth-specific value objects only).
- A single role per user is sufficient for the SaaS's authorisation needs; no multi-role / fine-grained permissions in this feature.
- HS256 (symmetric) signing is acceptable because the API is the only token verifier. RS256 / asymmetric signing is out of scope until a third-party verifier exists.
- Token revocation is out of scope. Tokens are valid until they expire; logout is a client-side discard.
- Refresh tokens are out of scope; access tokens are the only token shape in this feature.
- Password reset, email verification, MFA, and account lockout are out of scope.
- Rate limiting on login is out of scope (handled at infrastructure layer when needed).

## Out of Scope

- Password reset / email verification / MFA / account lockout
- Refresh tokens, token revocation lists, session blacklists
- OAuth2 / SSO / SAML / social login
- Per-resource permissions beyond the three role tiers
- Audit log persistence schema (logging only goes to stdout for now)
