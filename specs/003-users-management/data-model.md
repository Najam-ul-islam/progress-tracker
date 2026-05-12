# Data Model: Users Management

**Feature**: `003-users-management`
**Date**: 2026-05-02

## Source of truth

`backend/app/modules/users/model.py` — extended in place. ADR-0003 still holds:
this is the only definition of the `User` SQLModel anywhere in the codebase.

## Entity: `User`

| Column          | Type           | Constraints                                                | Source       | Notes                                                                                                                                  |
| --------------- | -------------- | ---------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | INTEGER        | PRIMARY KEY                                                | feature 002  | Surrogate key. Stable.                                                                                                                |
| `name`          | VARCHAR(120)   | NOT NULL, length 1..120                                    | feature 002  | Free text; whitespace not stripped (admin choice).                                                                                    |
| `email`         | VARCHAR(320)   | NOT NULL, UNIQUE INDEX `ix_user_email`                     | feature 002  | Lowercased + stripped on write by `auth.schema.UserCreate`. Not modifiable through this feature (FR-012).                              |
| `password_hash` | VARCHAR        | NOT NULL                                                   | feature 002  | bcrypt `$2b$…`. Not modifiable through this feature (FR-012). Never serialised in any users-module response (FR-017, SC-006).         |
| `role`          | VARCHAR(16)    | NOT NULL, CHECK `role IN ('admin','manager','developer')`  | feature 002  | Constraint name `ck_user_role`. Stored as `str` (SQLModel cannot introspect `Literal`); enforced by Pydantic schema + DB CheckConstraint. |
| `created_at`    | TIMESTAMP      | NOT NULL, default `now(UTC)`                               | feature 002  | Set by application factory; not auto-updated.                                                                                          |
| **`is_active`** | BOOLEAN        | **NOT NULL, default TRUE**                                 | **003 NEW**  | `false` ⇒ user cannot log in (FR-013). Existing rows backfilled to `true` by the migration's column default.                          |
| **`updated_at`**| TIMESTAMP      | **NOT NULL, default `CURRENT_TIMESTAMP`**                  | **003 NEW**  | Maintained by application layer (R2/R4 in research). DB default exists only to satisfy NOT NULL during migration backfill.            |

### Indexes

- `PRIMARY KEY (id)` — feature 002.
- `UNIQUE INDEX ix_user_email (email)` — feature 002.
- *No index on `role` or `is_active`* — table cardinality is small (≤10k rows during
  MVP) and `GET /users/developers` does a full scan filtered in-memory. If profiling
  shows this is hot, a composite index `(role, is_active)` can be added in a follow-up.

### Constraints

- `ck_user_role` (CHECK) — `role IN ('admin','manager','developer')`. Feature 002.
- *No DB-level "at least one admin" partial index.* The last-admin invariant is
  enforced by application logic inside a transaction (FR-014, R4). A partial unique
  index cannot express "count >= 1" — that requires a constraint trigger, which is
  Postgres-only and would diverge from SQLite tests.

## State transitions

```text
                                ┌──────────────┐
   POST /auth/register  ───────►│ active=true  │
                                │ role=admin / │
                                │ manager /    │
                                │ developer    │
                                └──────┬───────┘
                                       │
                  ┌────────────────────┼────────────────────┐
                  │                    │                    │
   PATCH /users/{id} body              │            PATCH /users/{id}/status
   {role: <new_role>}                  │            {is_active: false}
   (admin only, last-admin             │            (admin only, last-admin
   guard applies if demotion)          │            guard applies if self+admin)
                  │                    │                    │
                  ▼                    │                    ▼
          ┌──────────────┐             │           ┌──────────────┐
          │ active=true  │             │           │ active=false │
          │ role=<new>   │             │           │ role=<same>  │
          └──────────────┘             │           └──────┬───────┘
                                       │                  │
                                       │                  │ PATCH /users/{id}/status
                                       │                  │ {is_active: true}
                                       │                  ▼
                                       │           ┌──────────────┐
                                       └──────────►│ active=true  │
                                                   │ role=<same>  │
                                                   └──────────────┘

   No DELETE state. Deactivation is the canonical "remove" path.
```

## Validation rules (per FR)

| FR     | Rule                                                                                                                                                | Layer                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| FR-002 | New columns `is_active` (NOT NULL default TRUE) and `updated_at` (NOT NULL default CURRENT_TIMESTAMP) added to `user`.                              | DB migration `20260503_add_is_active_and_updated_at_to_user.py` + SQLModel `Field` declarations. |
| FR-010 | `updated_at` is set on every successful write to a user row.                                                                                        | `users.repository.update_user` (application).    |
| FR-011 | `PATCH /users/{id}` with empty body or all-null fields returns 422.                                                                                 | Pydantic `UserUpdate` model_validator.           |
| FR-012 | `email`, `password_hash` cannot be modified through this feature. Requests including them return 422.                                               | `UserUpdate` and `UserStatusUpdate` schemas use `extra="forbid"`. |
| FR-013 | `is_active=False` ⇒ login returns 401 with the same body as wrong-password.                                                                         | `auth.service.authenticate_user` (one-line check raising `InvalidCredentialsError`). |
| FR-014 | Last admin cannot be demoted or deactivated. Both writes refuse with 409.                                                                           | `users.service.update_user_profile` and `change_user_status` call `count_active_admins(exclude_id=…)` inside the same transaction; raise `LastAdminError`. |
| FR-017 | No response body contains `password_hash`.                                                                                                          | `UserRead` schema does not declare the field.    |
| FR-018 | `role` validates against `Literal["admin","manager","developer"]`.                                                                                  | `UserUpdate.role` is `Optional[Literal[...]]`; Pydantic emits 422 on mismatch. |
| FR-019 | Non-existent user id returns 404 (read or write).                                                                                                   | Service raises `UserNotFoundError`; route maps to 404. |

## Schemas (Pydantic v2)

```python
class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")
    id: int
    name: str
    email: EmailStr
    role: Literal["admin", "manager", "developer"]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # NB: no password_hash field. FR-017, SC-006.

class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: Literal["admin", "manager", "developer"] | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "UserUpdate":
        if all(v is None for v in (self.name, self.role, self.is_active)):
            raise ValueError("at least one of name/role/is_active must be provided")
        return self

class UserStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool

UserListResponse = list[UserRead]
```

## Migration outline (`20260503_add_is_active_and_updated_at_to_user.py`)

```python
revision = "20260503_user_is_active_updated_at"
down_revision = "20260502_user"

def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "user",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
    )
    # The server defaults exist only to backfill existing rows during the migration.
    # Future writes always carry an explicit value from the application layer (R4).

def downgrade() -> None:
    op.drop_column("user", "updated_at")
    op.drop_column("user", "is_active")
```

## Referential integrity outlook

- The `User` table has no inbound foreign keys yet. Once `clients`, `projects`,
  `tasks`, etc. land, they will FK to `user.id` with `ON DELETE RESTRICT` (the soft-
  delete strategy means we should never actually delete; RESTRICT makes accidents
  obvious).
- Once a downstream FK exists, the soft-delete `is_active=false` path becomes
  load-bearing for "the developer who left the company" scenarios — their tasks/
  audit-log entries continue to FK to a user row that simply cannot log in.
