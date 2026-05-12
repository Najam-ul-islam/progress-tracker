"""Auth module: Pydantic v2 request/response schemas. No tables, no business logic."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


UserRole = Literal["admin", "manager", "developer"]


def _normalise_email(value: str) -> str:
    return value.strip().lower()


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole

    model_config = ConfigDict(extra="ignore")

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name cannot be blank")
        return stripped

    @field_validator("email", mode="before")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return _normalise_email(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(extra="ignore")

    @field_validator("email", mode="before")
    @classmethod
    def _normalise_email(cls, value: str) -> str:
        return _normalise_email(value)


class UserRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead


class AuthError(BaseModel):
    detail: str
