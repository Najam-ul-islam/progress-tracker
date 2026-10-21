"""Clients module: Pydantic v2 request/response schemas. No tables, no business logic.

All schemas use `extra="forbid"` (FR-015): unknown fields cause HTTP 422.
`ClientRead` adds `from_attributes=True` so it can be constructed straight from
ORM rows.

The phone format check is a pure-Python regex (research.md R2): leading `+`,
1–3 digit country code, total length 8–20 chars consisting of digits, spaces,
hyphens, and parentheses, ending in a digit.
"""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


_PHONE_RE = re.compile(r"^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$")
_PHONE_ERROR = (
    "phone must start with +, include a country code, "
    "and contain 8–20 valid characters"
)


class ClientCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=40)
    company_name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = None

    @field_validator("name", mode="after")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped

    @field_validator("email", mode="after")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("phone", mode="after")
    @classmethod
    def _validate_phone(cls, value: str) -> str:
        if not _PHONE_RE.fullmatch(value):
            raise ValueError(_PHONE_ERROR)
        return value


class ClientUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=8, max_length=40)
    company_name: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    notes: str | None = None

    @field_validator("name", mode="after")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped

    @field_validator("email", mode="after")
    @classmethod
    def _normalise_email(cls, value: str | None) -> str | None:
        return value.strip().lower() if value is not None else None

    @field_validator("phone", mode="after")
    @classmethod
    def _validate_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _PHONE_RE.fullmatch(value):
            raise ValueError(_PHONE_ERROR)
        return value

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ClientUpdate":
        if all(
            v is None
            for v in (
                self.name,
                self.email,
                self.phone,
                self.company_name,
                self.address,
                self.notes,
            )
        ):
            raise ValueError(
                "at least one of name/email/phone/company_name/address/notes "
                "must be provided"
            )
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
