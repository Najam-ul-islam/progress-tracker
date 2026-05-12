# Data Model: Clients Management

**Feature**: `004-clients-management`
**Date**: 2026-05-03

## Source of truth

`backend/app/modules/clients/model.py` — created in this feature. Mirroring
ADR-0003 for `User`: this is the only definition of the `Client` SQLModel
anywhere in the codebase. The projects module (when it ships) FKs to
`client.id`; it MUST NOT redefine the entity.

## Entity: `Client`

| Column          | Type                       | Constraints                                                                                | Notes                                                                                                |
| --------------- | -------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `id`            | INTEGER                    | PRIMARY KEY, autoincrement                                                                 | Surrogate key. Stable.                                                                               |
| `name`          | VARCHAR(120)               | NOT NULL, length 1..120                                                                    | Display name. Whitespace stripped at the schema layer.                                               |
| `email`         | VARCHAR(320)               | NOT NULL, partial-unique among `is_active = TRUE` (`ix_client_email_active`)               | Lowercased + stripped on write by `ClientCreate.field_validator`. `EmailStr`-validated.              |
| `phone`         | VARCHAR(40)                | NOT NULL, partial-unique among `is_active = TRUE` (`ix_client_phone_active`)               | Regex-validated `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$` at the schema layer. Stored as submitted (R2).      |
| `company_name`  | VARCHAR(200)               | NULL                                                                                       | Optional.                                                                                            |
| `address`       | VARCHAR(500)               | NULL                                                                                       | Optional.                                                                                            |
| `notes`         | TEXT                       | NULL                                                                                       | Optional plain text.                                                                                 |
| `is_active`     | BOOLEAN                    | NOT NULL, default TRUE                                                                     | `false` ⇒ soft-deleted; invisible to public reads (FR-014). Mirrors the User pattern from feature 003. |
| `created_at`    | TIMESTAMP(timezone=True)   | NOT NULL, default `CURRENT_TIMESTAMP`                                                      | Set by application factory; not auto-updated.                                                        |
| `updated_at`    | TIMESTAMP(timezone=True)   | NOT NULL, default `CURRENT_TIMESTAMP`                                                      | App-layer maintained on every successful write (FR-013); DB default exists only to satisfy NOT NULL. |

### Indexes

- `PRIMARY KEY (id)`.
- `ix_client_email_active` — partial unique on `(email)` filtered by
  `is_active = TRUE`. Both Postgres and SQLite support this natively.
- `ix_client_phone_active` — partial unique on `(phone)` filtered by
  `is_active = TRUE`.

### Constraints

- *No `CHECK` constraints* on this table. `phone` regex and `email` format
  are enforced exclusively at the schema layer (R2) — the database does not
  validate the format because pushing regex into a `CHECK` would diverge
  between SQLite (limited regex) and Postgres.

### Why partial unique vs. plain unique?

Spec edge case: a soft-deleted client with `email = X` MUST NOT block a new
`POST /clients` with `email = X`. A plain `UNIQUE INDEX` would block forever
(the row stays in the table per FR-014). A partial index restricted to
`is_active = TRUE` enforces the rule only against live rows. See R1 for the
full rejection of alternatives.

## State transitions

```text
                              ┌──────────────┐
   POST /clients      ───────►│ active=true  │
                              └──────┬───────┘
                                     │
                       PATCH /clients/{id}
                       (partial field update; uniqueness re-checked)
                                     │
                                     ▼
                              ┌──────────────┐
                              │ active=true  │
                              │ <updated>    │
                              └──────┬───────┘
                                     │
                       DELETE /clients/{id}
                       (admin only — soft delete)
                                     │
                                     ▼
                              ┌──────────────┐
                              │ active=false │  ⟵ invisible to GET /clients[/id]
                              │ updated_at⇪  │  ⟵ row preserved for FK integrity
                              └──────────────┘

   No reactivation path in this feature (Edge Cases).
   No hard DELETE state (FR-014).
```

## Validation rules (per FR)

| FR     | Rule                                                                                                                                                                | Layer                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| FR-002 | `Client` has all 10 columns above with the listed types and NOT-NULL flags.                                                                                         | DB migration `20260504_create_client_table.py` + SQLModel `Field` declarations. |
| FR-007 | `email` is a syntactically valid email; lowercased + stripped on write.                                                                                             | `ClientCreate.email: EmailStr` + `field_validator` lowercasing. |
| FR-008 | `phone` matches `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$` (≥1 country-code digit, 8–20 chars total, ends in a digit).                                                       | `ClientCreate.phone` Pydantic `field_validator` (R2).        |
| FR-009 | `POST /clients` refuses duplicate `email` or `phone` among active rows; service does the proactive check, partial unique index is the ultimate guard.               | `clients.service.create_client` + `ix_client_*_active` indexes. |
| FR-010 | `PATCH /clients/{id}` enforces the same uniqueness rules, evaluated against every other active row.                                                                 | `clients.service.update_client`.                             |
| FR-011 | `PATCH /clients/{id}` with empty body or all-null fields returns 422.                                                                                               | Pydantic `ClientUpdate.model_validator(mode="after")`.       |
| FR-013 | `updated_at` is set on every successful write to a client row.                                                                                                      | `clients.repository.update_client` + `soft_delete_client`.   |
| FR-014 | A soft-deleted client is invisible to every public read. `get_client_by_id` filters `is_active = TRUE`; `list_clients` filters the same.                            | `clients.repository`.                                        |
| FR-015 | Request bodies on POST/PATCH are closed (`extra="forbid"`).                                                                                                         | `ClientCreate` / `ClientUpdate` schema configs.              |
| FR-019 | Non-existent (or soft-deleted) client id returns 404.                                                                                                               | Service raises `ClientNotFoundError`; route maps to 404.     |

## Schemas (Pydantic v2)

```python
# app/modules/clients/schema.py

from datetime import datetime
from typing import Literal
import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# Phone: leading +, 1–3 digit country code, 8–20 chars total, ends with a digit.
_PHONE_RE = re.compile(r"^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$")


class ClientCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=40)
    company_name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = None

    @field_validator("email", mode="after")
    @classmethod
    def _normalise_email(cls, v: EmailStr) -> EmailStr:
        return EmailStr(v.strip().lower())

    @field_validator("phone", mode="after")
    @classmethod
    def _validate_phone(cls, v: str) -> str:
        if not _PHONE_RE.fullmatch(v):
            raise ValueError("phone must start with +, include a country code, and contain 8–20 valid characters")
        return v


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=8, max_length=40)
    company_name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = None

    @field_validator("email", mode="after")
    @classmethod
    def _normalise_email(cls, v: EmailStr | None) -> EmailStr | None:
        return EmailStr(v.strip().lower()) if v is not None else None

    @field_validator("phone", mode="after")
    @classmethod
    def _validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not _PHONE_RE.fullmatch(v):
            raise ValueError("phone must start with +, include a country code, and contain 8–20 valid characters")
        return v

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ClientUpdate":
        if all(
            v is None
            for v in (self.name, self.email, self.phone, self.company_name, self.address, self.notes)
        ):
            raise ValueError("at least one of name/email/phone/company_name/address/notes must be provided")
        return self


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    email: EmailStr
    phone: str
    company_name: str | None
    address: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


ClientListResponse = list[ClientRead]
```

## Migration outline (`20260504_create_client_table.py`)

```python
"""create client table

Revision ID: 20260504_client
Revises: 20260503_user_is_active_updated_at
Create Date: 2026-05-03
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa


revision = "20260504_client"
down_revision = "20260503_user_is_active_updated_at"
branch_labels = None
depends_on = None


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
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.current_timestamp(),
        ),
    )
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


def downgrade() -> None:
    op.drop_index("ix_client_phone_active", table_name="client")
    op.drop_index("ix_client_email_active", table_name="client")
    op.drop_table("client")
```

## Referential integrity outlook

- The `Client` table has no inbound foreign keys yet. Once the projects
  module ships, `project.client_id` will FK to `client.id` with
  `ON DELETE RESTRICT` (matching the User stance). The soft-delete strategy
  guarantees the FK is never orphaned because no row is ever physically
  removed by the public API.
- The `Client` table has no outbound foreign keys. A future
  `client_owner_user_id` FK to `user.id` is explicitly **out of scope** for
  this feature (see spec Assumptions); it would be added only when the
  projects module surfaces a "who owns the client" UX requirement.

## Storage footprint estimate

For the medium-term scale target (≤ a few thousand clients), the table at
average string lengths is well under 5 MB; both partial indexes combined add
≤ 2 MB. No partitioning, no archive table — same scale envelope as feature
003's User table.
