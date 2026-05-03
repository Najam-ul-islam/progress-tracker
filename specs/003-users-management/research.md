# Research: Users Management

**Feature**: `003-users-management`
**Date**: 2026-05-02
**Status**: All NEEDS CLARIFICATION resolved

## Scope

This document records the technical decisions taken between the spec and the plan.
Each decision is a small, narrowly-scoped choice — not an architectural pivot. The
larger architectural ground (single-User-model, modular six-file layout, JWT/bcrypt
ownership) is already settled by ADR-0001/0002/0003 and the auth feature's
`research.md`. This file only adds what's new.

---

## R1 — How to add `is_active` and `updated_at` without breaking existing rows

**Decision**: One alembic revision (`20260503_add_is_active_and_updated_at_to_user`)
that:

1. Adds `is_active BOOLEAN NOT NULL DEFAULT TRUE` to `user`. The default backfills
   existing rows in a single statement; no Python loop required.
2. Adds `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` to `user`. Existing
   rows get the migration time as their initial `updated_at`; new rows fall back to
   `created_at` semantics in the application layer.
3. After the columns are populated, the application layer (repository) takes over:
   `updated_at` is set explicitly on every write. The DB-level default exists only to
   make the migration idempotent and to satisfy `NOT NULL` for any out-of-band insert.

**Rationale**: This is the simplest forward-compatible migration. The DB default
handles the backfill; the application owns ongoing writes. No data backfill script
required, no two-step deploy.

**Alternatives considered**:

- *Nullable `updated_at` with no default* — rejected. Would let an empty value
  indicate "never updated", which the API consumers shouldn't have to handle.
- *DB trigger to maintain `updated_at`* — rejected. SQLite (used in tests) does not
  support `ON UPDATE CURRENT_TIMESTAMP` in the same dialect Postgres does. Keeping
  maintenance in the application layer keeps test/prod parity. (See the suggested
  ADR `updated-at-maintenance`.)
- *Two separate revisions, one per column* — unnecessary; both columns are part of
  the same feature surface.

---

## R2 — Reusing the existing User SQLModel vs. extending it

**Decision**: Extend `app/modules/users/model.py` in place. Add two `Field(...)`
declarations to the existing `User` class:

```python
is_active: bool = Field(default=True, nullable=False)
updated_at: datetime = Field(
    default_factory=lambda: datetime.now(timezone.utc),
    nullable=False,
)
```

The existing fields (`id`, `name`, `email`, `password_hash`, `role`, `created_at`)
are unchanged. `__table_args__` (the `ck_user_role` `CheckConstraint`) is unchanged.

**Rationale**: ADR-0003 makes `users/model.py` the single source of truth for the
User entity. Any other module that needs additional user state (e.g., `developers`
adds `skills`) extends this same class — never redefines it.

**Alternatives considered**:

- *Subclassing `User` for "active user" / "managed user"* — rejected. SQLModel
  table inheritance creates surprising query semantics; the ADR-0003 spirit is "one
  table, one class".
- *Side table `user_status`* — rejected. The fields are intrinsic to identity, not
  to a separate domain. Joining for every lookup is needless overhead.

---

## R3 — Schema layer composition

**Decision**: `app/modules/users/schema.py` declares four schemas, all Pydantic v2
with `ConfigDict(from_attributes=True, extra="forbid")`:

- **`UserRead`** — public output shape: `{id, name, email, role, is_active,
  created_at, updated_at}`. **No `password_hash`** field at all (FR-017, SC-006).
- **`UserUpdate`** — input for `PATCH /users/{id}`: all three fields optional
  (`name`, `role`, `is_active`); `extra="forbid"` rejects `password`, `email`, etc.
  with HTTP 422 (FR-012). A model validator rejects empty patches (FR-011).
- **`UserStatusUpdate`** — input for `PATCH /users/{id}/status`: `{is_active: bool}`.
  Single field, required. `extra="forbid"`.
- **`UserListResponse`** — `list[UserRead]` (alias for the array form). MVP returns
  the unwrapped array; the type alias exists so future pagination wraps it without
  forcing every caller to change types.

**Rationale**: Keep the schemas small and the response/request shapes orthogonal.
`extra="forbid"` is the cheapest way to enforce FR-012 (no email/password updates
through this surface).

**Alternatives considered**:

- *Single `UserUpsert` schema reused for create + update* — rejected. The auth
  module already owns `UserCreate`; users module is read-and-update-only.
- *Returning `UserRead` from `User.model_dump()` directly inside routes* — rejected
  because FR-017 demands a guaranteed `password_hash` exclusion at the schema layer,
  not by relying on every route to remember to redact.

---

## R4 — Repository layer: queries needed and locking semantics

**Decision**: `app/modules/users/repository.py` is extended (not rewritten). The
existing helpers (`get_user_by_email`, `get_user_by_id`, `create_user`) stay
exactly as they are. Four new helpers are added:

- `list_users(session) -> list[User]` — `SELECT * FROM user ORDER BY id`.
- `list_developers(session) -> list[User]` — same as above with
  `WHERE role = 'developer' AND is_active = TRUE`.
- `update_user(session, user, **fields) -> User` — applies the update on the
  passed-in `User` instance, sets `updated_at = datetime.now(timezone.utc)`,
  flushes, refreshes, returns. Caller is responsible for having looked the user up.
- `count_active_admins(session, *, exclude_id: int | None = None) -> int` — used
  by the last-admin guard. Optional `exclude_id` lets the service ask "if I demote
  user X, how many active admins remain?" without an extra in-memory subtraction.

**Locking strategy**: For the last-admin guard the service-layer calls
`session.exec(select(User).where(User.id == target_id).with_for_update())` first
inside a transaction; then `count_active_admins(exclude_id=target_id)` runs in the
same transaction. Postgres honours `FOR UPDATE`; SQLite ignores it but the test
suite is single-threaded so the race cannot occur in tests. (See the suggested
ADR `last-admin-invariant`.)

**Rationale**: Repository helpers stay narrow; the locking semantics live with the
business rule, not with the generic `update_user`.

**Alternatives considered**:

- *Generic `update_by_id` repository helper that takes a dict* — rejected; would
  silently accept fields the schema layer is supposed to reject. Forcing the caller
  to pass `**fields` keeps the surface explicit and lets mypy catch typos.
- *Optimistic concurrency via a `version` column on User* — rejected as
  out-of-scope and not required by any FR. The race the spec cares about is
  specifically "last admin", which `FOR UPDATE` solves.

---

## R5 — Service layer business rules and the auth bridge

**Decision**: `app/modules/users/service.py` exposes five callable surfaces. Each
takes a `Session` and the acting `User` (already resolved by `get_current_user`),
plus story-specific arguments. They raise typed exceptions that `routes.py`
translates into HTTP responses:

- `get_user_profile(session, *, target_id, requester) -> UserRead` — implements
  the developer-self-only rule for `GET /users/{id}` (FR-005). 404 first, then 403
  ordering: missing id wins over forbidden (otherwise we'd leak whether an id
  exists by returning 403 vs 404 — but a developer attempting another id never
  needs to know the id existed).
  - Correction after re-reading FR-005 + FR-019: developers attempting to read a
    foreign id must get **403 not 404**, because they should not be able to probe
    for valid ids. So the order is: authorise first (developers only allowed if
    `target_id == requester.id`), then look up. Admin/manager get the lookup
    first, then 404. Documented in `contracts/access-control-matrix.md`.
- `list_users(session, *, requester) -> list[UserRead]` — admins/managers only,
  enforced by route-level `Depends(require_any("admin", "manager"))`. Service
  re-asserts (defence in depth) but trusts the dependency for the 403 path.
- `list_developers(session, *, requester) -> list[UserRead]` — same as above,
  filtered.
- `update_user_profile(session, *, target_id, patch: UserUpdate, requester) -> UserRead`:
  - Empty patch → raise `EmptyUpdateError` → 422 (FR-011).
  - `target_id` doesn't exist → raise `UserNotFoundError` → 404 (FR-019).
  - If `patch.role` is set or `patch.is_active is False` and `target_id ==
    requester.id`, run the last-admin guard (FR-014); on violation raise
    `LastAdminError` → 409.
  - Otherwise apply via repository, set `updated_at`, return `UserRead`.
- `change_user_status(session, *, target_id, patch: UserStatusUpdate, requester) -> UserRead`:
  - 404 if missing.
  - 409 if `requester.id == target_id and patch.is_active is False` (self-deactivation
    is not allowed even for admins — FR-014's second leg).
  - Otherwise apply.

**Auth bridge** (the only edit outside `users/`): inside
`app/modules/auth/service.py::authenticate_user`, **after** the password verification
succeeds, add:

```python
if not user.is_active:
    raise InvalidCredentialsError  # FR-013: deactivated users cannot log in
```

This raises the same exception the wrong-password path raises, which the routes
layer already maps to a generic 401 with the same body — preserving SC-005's
byte-identical envelope from feature 002.

**Rationale**: All business rules colocated with the writes they constrain; the
auth bridge is one line; no role check duplicated across routes and service.

**Alternatives considered**:

- *Move FR-013 to `auth.dependencies.get_current_user`* — rejected; this would also
  block ongoing API requests for users deactivated mid-session, which is the
  long-term right behaviour but is *out of scope* for this feature (it would
  invalidate all live tokens of deactivated users, which is a separate decision
  about session revocation). For now: deactivation prevents future logins; live
  tokens still work until they expire (≤ 60 min).
- *Make the last-admin guard a SQLAlchemy event listener* — rejected; would split
  the rule across modules and obscure the test coverage path.

---

## R6 — Test fixture extensions

**Decision**: `backend/tests/conftest.py` already has `seed_user(role, ...)`. Add
three thin convenience wrappers as fixtures:

- `seed_admin(session)` → `seed_user(role="admin", email="admin@test.local", ...)`.
- `seed_manager(session)` → `seed_user(role="manager", ...)`.
- `seed_developer(session)` → `seed_user(role="developer", ...)`.

And one helper `make_token(user) -> str` that calls `core.security.create_access_token`
with the seeded user's id/email/role. (Tests already use this pattern inline; the
fixture removes the boilerplate.) These are *additions*; no existing fixture is
modified.

**Rationale**: Tests in this feature need 3+ users per scenario (admin doing a thing
to a developer with a manager watching); the wrapper fixtures keep arrangements terse.

**Alternatives considered**:

- *Factory-boy / pytest-factoryboy* — rejected; one new dev dep for what is six
  lines of glue is not worth the learning curve.

---

## R7 — Audit script for FR-020 (users → auth dependency direction)

**Decision**: Add `backend/scripts/audit_users_imports.sh`, mirror of
`audit_auth_imports.sh`. It greps `app/modules/users/**.py` for
`from app.modules.auth` and **allows only** `from app.modules.auth.dependencies`
(infrastructure). Any import from `auth.service`, `auth.repository`, or
`auth.schema` (business logic) fails the script.

Ran locally as `bash backend/scripts/audit_users_imports.sh`. Same exit-code
contract as the existing two audit scripts.

**Rationale**: FR-020 says "MUST NOT import any business logic from auth"; that's
ambiguous on its own. Encoding it as a grep rule makes it auditable and CI-runnable.

**Alternatives considered**:

- *Static import-graph tool (e.g. `import-linter`)* — rejected for now; the project
  already uses grep audits for SC-006 / SC-007. Consistency with existing pattern.

---

## Summary

All decisions are local extensions of the architecture already established by
features 001–002. No new languages, frameworks, dependencies, or directory
conventions are introduced. Three decisions pass the ADR significance test and are
flagged in `plan.md` as ADR suggestions (soft-delete strategy, `updated_at`
maintenance, last-admin invariant); none are auto-created.
