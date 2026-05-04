# Research: Clients Management

**Feature**: `004-clients-management`
**Date**: 2026-05-03
**Status**: All NEEDS CLARIFICATION resolved

## Scope

This document records the technical decisions taken between the spec and the
plan for the clients module. Each decision is small and narrowly-scoped; the
broader architectural ground (single-source-of-truth per entity, six-file
modular layout, RBAC via `auth.dependencies`, soft-delete pattern, app-layer
`updated_at`, grep-audit-as-CI) is already settled by ADRs 0001/0002/0003 and
features 002/003. This file only covers what is new for clients.

---

## R1 — Uniqueness on `email` and `phone`: how to enforce among **active** rows only

**Decision**: A **partial unique index** on each column, filtered by
`is_active = TRUE`. Two indexes total:

```python
# alembic upgrade()
op.create_index(
    "ix_client_email_active",
    "client",
    ["email"],
    unique=True,
    postgresql_where=sa.text("is_active = TRUE"),
    sqlite_where=sa.text("is_active = 1"),
)
op.create_index(
    "ix_client_phone_active",
    "client",
    ["phone"],
    unique=True,
    postgresql_where=sa.text("is_active = TRUE"),
    sqlite_where=sa.text("is_active = 1"),
)
```

Both Postgres and SQLite support partial indexes natively. SQLAlchemy/Alembic
expose them via the `*_where` dialect-prefixed kwargs above. The alembic
revision passes both kwargs; whichever dialect is in use picks the matching one.

**Rationale**: The Edge Case in the spec ("a client soft-deleted with email X
does not block a new POST with email X") demands that uniqueness applies only
to live rows. A regular `UNIQUE INDEX` would block re-use forever after a
single offboarding. A partial index is the smallest, most direct way to
express the rule and lets the database catch races the application read-then-
write missed (FR-009 second guarantee).

**Alternatives considered**:

- *Plain `UNIQUE INDEX (email)` + application-level "skip soft-deleted"* —
  rejected. The DB would still refuse the second insert; we'd need to either
  hard-delete on offboarding (violates FR-014's FK-preservation argument) or
  rotate the email column to something like `email__deleted_at_<timestamp>`
  on soft-delete (a write-on-delete that complicates reactivation later).
- *Composite unique on `(email, is_active)`* — rejected. This permits
  unlimited soft-deleted rows with the same email but only **one** active —
  good. **However**, two *inactive* rows with the same email are also
  permitted, which is fine. The semantics are equivalent to a partial index
  for our use case, but the partial index is clearer in `\d client` /
  `pragma index_list` output and matches the project's "constraint expresses
  intent" style.
- *No DB-level uniqueness, just application read-then-write* — rejected. The
  spec's race-condition assumption (under "Assumptions") explicitly relies on
  the unique index as the ultimate guard against concurrent creates.

---

## R2 — Phone validation: regex now vs `phonenumbers` library later

**Decision**: Strict regex only (FR-008): `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$`.
Compiled once at module import time. No third-party library added.

**Rationale**: The spec explicitly defers true E.164 normalisation
(canonicalisation, country-of-origin disambiguation) until duplicate-phone
collisions surface in practice. Adding `phonenumbers` (a 5MB pure-Python
package with a C-extension companion) for what is a regex-shaped problem in
MVP is premature and would introduce a regulatory-data-bundle dependency we
do not yet need. The regex above guarantees:

- A leading `+`.
- A 1–3 digit country code.
- A total length of 8–20 characters (matches E.164's 8–15-digit body plus
  punctuation slack).
- An ending digit (no trailing space/punctuation).

This catches every realistic typo the schema is meant to catch (missing `+`,
all-letters, bare 7-digit local number) without taking a position on whether
`+1 415 555 0101` and `+14155550101` represent the same person — they don't,
according to FR-008's storage rule (store as submitted; uniqueness sees them
as different strings). That is the trade we are accepting in MVP.

**Alternatives considered**:

- *`pydantic_extra_types.PhoneNumber`* — wraps `phonenumbers`. Same critique
  as above, plus it would canonicalise on input, which would silently rewrite
  the user's submitted phone — surprising in error reports and breaks the
  spec's "store as submitted" rule. Rejected.
- *Async lookup of carrier validity (Twilio, etc.)* — out of scope and would
  introduce an external network call into the create path. Rejected.

📋 Architectural decision detected: phone validation strategy (regex now,
library later). Document reasoning and tradeoffs? Run
`/sp.adr phone-validation-regex-vs-library`.

---

## R3 — Schema layer composition

**Decision**: `app/modules/clients/schema.py` declares four schemas, all
Pydantic v2 with `ConfigDict(extra="forbid")` (and `from_attributes=True` for
the read shape). The role `Literal` is **imported** from
`app.modules.auth.schema` to keep one source of truth (FR-020 explicitly
allows this — the role enum is a closed contract, not business logic).

- **`ClientCreate`** — input for `POST /clients`: `name` (required, 1..120),
  `email` (`EmailStr`, required), `phone` (regex-validated, required),
  `company_name` / `address` / `notes` (all optional). On write, `email` is
  lowercased + stripped via a `field_validator`. `extra="forbid"`.
- **`ClientUpdate`** — input for `PATCH /clients/{id}`: every field optional;
  `extra="forbid"`. A `model_validator(mode="after")` rejects empty patches
  (FR-011) — the same pattern feature 003 used for `UserUpdate`.
- **`ClientRead`** — public output: `{id, name, email, phone, company_name,
  address, notes, is_active, created_at, updated_at}`. `from_attributes=True`
  + `extra="forbid"`. **Includes `is_active`** so admins can see deactivation
  state in audit views; the spec's "soft-deleted rows are invisible to public
  reads" guarantee (FR-014) holds because no read endpoint returns a row with
  `is_active = False` in the first place.
- **`ClientListResponse`** — `list[ClientRead]` (alias). MVP returns the
  unwrapped array; the alias exists so future pagination wraps it without
  forcing every caller to change types. Same pattern as `UserListResponse`.

**Rationale**: Mirror feature 003's schema layout exactly — readers and
reviewers benefit from one shape per module. `extra="forbid"` is the cheapest
enforcement of FR-015 (closed schemas).

**Alternatives considered**:

- *Separate `ClientReadAdmin` (with `is_active`) vs `ClientReadPublic`
  (without)* — rejected. The endpoints are admin/manager-only anyway, and a
  bifurcated read shape adds a permission-context-sensitive serialiser that
  is not justified by any FR.
- *Enable `from_attributes` on every schema* — rejected for the input ones;
  they never need to construct from ORM objects.

---

## R4 — Repository layer: queries needed and uniqueness translation

**Decision**: `app/modules/clients/repository.py` exposes six helpers. None
contains business logic; each is a single SQL statement with a clear contract:

- `create_client(session, **fields) -> Client` — inserts; on
  `IntegrityError` from the partial unique index, raises
  `DuplicateClientError(field=...)` (the field is parsed from the
  constraint name `ix_client_email_active` / `ix_client_phone_active`).
- `get_client_by_id(session, id) -> Client | None` — `SELECT * FROM client
  WHERE id = :id AND is_active = TRUE`. Soft-deleted rows are not returned
  (FR-014). The "include inactive" path is **not** offered by this feature;
  if reactivation ships later, it adds a separate `_include_inactive=True`
  flag.
- `list_clients(session) -> list[Client]` — `SELECT * FROM client WHERE
  is_active = TRUE ORDER BY id`.
- `find_active_client_by_email(session, email) -> Client | None` —
  `SELECT * FROM client WHERE email = :email AND is_active = TRUE LIMIT 1`.
  Used by the service for the proactive uniqueness check.
- `find_active_client_by_phone(session, phone) -> Client | None` — same
  shape as above for `phone`.
- `update_client(session, client, **fields) -> Client` — applies the diff,
  bumps `updated_at`, flushes/refreshes/returns. Mirrors `users.update_user`.
- `soft_delete_client(session, client) -> None` — sets `is_active = False`,
  bumps `updated_at`, flushes/commits.

**Race-condition handling**: the proactive `find_active_client_by_email` /
`_phone` checks happen inside the same session as the insert. Postgres'
default isolation (READ COMMITTED) does **not** serialise these reads, so the
DB partial unique index is the ultimate guard. The repository converts the
`IntegrityError` into a `DuplicateClientError` with the correct field name so
the service can emit the same 409 envelope whether the duplicate was caught
proactively or by the index — a single response shape for clients.

**Rationale**: The narrow surface keeps the service layer's logic readable;
the locking/isolation concern is colocated with the insert path that needs it.

**Alternatives considered**:

- *Generic `find_active_by(session, **filters)` helper* — rejected. Mirrors
  the rejection in feature 003 of `update_by_id(dict)`: a closed surface lets
  mypy catch typos and lets reviewers reason about which queries are
  parameterised vs literal.
- *Use `session.scalar(...)` everywhere* — rejected; the project's
  established pattern in `users/repository.py` is `session.exec(...).first()`
  / `.all()`. Consistency wins.

---

## R5 — Service layer business rules

**Decision**: `app/modules/clients/service.py` exposes five callables. Each
takes a `Session` and (where relevant) the acting `User` (already resolved
by `get_current_user`), plus story-specific arguments. They raise typed
exceptions that `routes.py` translates into HTTP responses:

```text
class ClientNotFoundError(Exception): ...
class DuplicateClientError(Exception):
    """Carries .field in {'email','phone'}."""
    field: str
```

- `create_client(session, *, payload: ClientCreate, requester: User) -> ClientRead`:
  - Look up `find_active_client_by_email(payload.email)`; if hit → raise
    `DuplicateClientError(field='email')`.
  - Look up `find_active_client_by_phone(payload.phone)`; if hit → raise
    `DuplicateClientError(field='phone')`.
  - Call `repository.create_client(...)`. If the DB raises
    `DuplicateClientError`, re-raise (handled identically by the route).
- `get_client(session, *, client_id: int) -> ClientRead`:
  - `get_client_by_id`; `None` → raise `ClientNotFoundError`.
- `list_clients(session) -> list[ClientRead]` — wraps the repository.
- `update_client(session, *, client_id: int, patch: ClientUpdate) -> ClientRead`:
  - `get_client_by_id`; `None` → raise `ClientNotFoundError`.
  - For each of `email` / `phone` actually present in the patch, call the
    `find_active_*` lookup; if hit AND the matched id is not the target's →
    raise `DuplicateClientError(field=...)`.
  - Call `repository.update_client(client, **fields)`.
- `delete_client(session, *, client_id: int) -> None`:
  - `get_client_by_id`; `None` → raise `ClientNotFoundError` (idempotent
    re-delete still surfaces 404 because soft-deleted rows are invisible —
    matches FR-019).
  - `repository.soft_delete_client(client)`.

**Rationale**: All business rules colocated with the writes they constrain;
the route file stays free of try/except sprawl by mapping a small set of typed
exceptions.

**Alternatives considered**:

- *Single `upsert_client` that branches on whether `id` was passed* —
  rejected. POST and PATCH have different uniqueness semantics (POST checks
  against all active rows; PATCH excludes the target's own id) and merging
  them obscures both.
- *Move the duplicate check into the schema's `model_validator`* — rejected.
  The schema cannot reach the database; pushing it into the schema would mean
  duplicating the SQL into a Pydantic context that has no session.

---

## R6 — Test fixture extensions

**Decision**: `backend/tests/conftest.py` already has
`seed_admin / seed_manager / seed_developer / make_token / auth_header` from
feature 003. **No new fixtures** are required for clients — the existing ones
cover every RBAC matrix cell. Each clients test file calls those fixtures
directly.

The clients tests **add seed data via the API** (`POST /clients`) rather than
through a `seed_client` fixture. Rationale: the create endpoint is itself the
unit under test in US1, and threading the same payload through both a fixture
and US1 would duplicate the source of truth. For US2/US3/US4 the create call
in the test body is one line and makes the seeded state explicit.

**Rationale**: Smallest possible diff to `conftest.py` (zero lines for this
feature). Keeps the test pattern uniform across features 002/003/004.

**Alternatives considered**:

- *Add a `seed_client` fixture for US2–US4 brevity* — rejected. The
  `/clients` POST is one line per scenario; adding a fixture would split the
  "what fields a Client has" knowledge between two files.

---

## R7 — Audit script for FR-020 (clients module boundaries)

**Decision**: Add `backend/scripts/audit_clients_imports.sh`, mirroring
`audit_users_imports.sh`. It greps `app/modules/clients/**.py` and **fails**
on any import from `app.modules.users`, `app.modules.projects`, or
`app.modules.payments`. From `app.modules.auth` it allows only
`app.modules.auth.dependencies` and `app.modules.auth.schema` (the latter
strictly for the role `Literal`; see R3).

```bash
violations=$(
  grep -RIn --include='*.py' -E '^\s*(from app\.modules\.(users|projects|payments)|import app\.modules\.(users|projects|payments))' app/modules/clients \
    || true
)
violations_auth=$(
  grep -RIn --include='*.py' -E '^\s*(from app\.modules\.auth|import app\.modules\.auth)' app/modules/clients \
    | grep -vE 'app\.modules\.auth\.(dependencies|schema)' \
    || true
)
```

Same exit-code contract as the two existing audit scripts; printed status
line `OK: clients module only imports app.modules.auth.{dependencies,schema}`
on success.

**Rationale**: FR-020 / FR-021 say "MUST NOT import any business logic from
auth/users/projects/payments". Encoding it as a grep rule makes it auditable
and CI-runnable. Allowing `auth.schema` is a deliberate narrow escape so the
role `Literal` source-of-truth stays in one place — every module that needs
RBAC schema fragments imports them from `auth.schema` until volume justifies
moving them to `app.shared.constants`.

**Alternatives considered**:

- *`import-linter` config file* — rejected for now; the project already uses
  shell grep audits. Consistency with the existing pattern wins.

---

## R8 — Migration (`20260504_create_client_table.py`)

**Decision**: One alembic revision creates the table and the two partial
unique indexes:

```python
revision = "20260504_client"
down_revision = "20260503_user_is_active_updated_at"

def upgrade() -> None:
    op.create_table(
        "client",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("phone", sa.String(40), nullable=False),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  nullable=False, server_default=sa.func.current_timestamp()),
    )
    op.create_index(
        "ix_client_email_active", "client", ["email"], unique=True,
        postgresql_where=sa.text("is_active = TRUE"),
        sqlite_where=sa.text("is_active = 1"),
    )
    op.create_index(
        "ix_client_phone_active", "client", ["phone"], unique=True,
        postgresql_where=sa.text("is_active = TRUE"),
        sqlite_where=sa.text("is_active = 1"),
    )

def downgrade() -> None:
    op.drop_index("ix_client_phone_active", table_name="client")
    op.drop_index("ix_client_email_active", table_name="client")
    op.drop_table("client")
```

Server defaults exist only to satisfy NOT NULL during the migration's initial
table creation; future writes always carry an explicit value from the
application layer (matches feature 003 R4).

**Rationale**: One migration, one revision, no data backfill (the table is
new). Forward and backward steps are trivially symmetric.

**Alternatives considered**:

- *Two migrations (table, then indexes)* — unnecessary; both belong to the
  same feature surface.

---

## Summary

All decisions are local extensions of the architecture already established
by features 001–003. No new languages, frameworks, or directory conventions
are introduced. Two new dependencies (Pydantic `EmailStr` is already in via
`email-validator`; the phone regex needs nothing) — `pyproject.toml` is
unchanged. Three decisions pass the ADR significance test and are flagged in
`plan.md` as ADR suggestions (`clients-soft-delete-strategy`,
`unique-partial-index-among-active-rows`, `phone-validation-regex-vs-library`);
none are auto-created.
