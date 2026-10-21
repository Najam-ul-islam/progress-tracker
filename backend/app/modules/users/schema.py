"""Users module: Pydantic v2 request/response schemas. No tables, no business logic.

All schemas use ``extra="forbid"`` so requests with unknown fields (notably
``email`` and ``password_hash``) return HTTP 422 (FR-012). ``UserRead`` does not
declare ``password_hash`` so it can never appear in any 2xx response (FR-017,
SC-006).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


UserRole = Literal["admin", "manager", "developer"]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    role: UserRole | None = None
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


__all__ = [
    "UserRead",
    "UserUpdate",
    "UserStatusUpdate",
    "UserListResponse",
    "UserRole",
]
