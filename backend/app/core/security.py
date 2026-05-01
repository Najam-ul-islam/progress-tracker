"""JWT and password hashing primitives. Implementations land in the auth feature."""

from __future__ import annotations

from typing import Any


def create_access_token(subject: str, claims: dict[str, Any] | None = None) -> str:
    raise NotImplementedError("Implement in the auth feature.")


def decode_access_token(token: str) -> dict[str, Any]:
    raise NotImplementedError("Implement in the auth feature.")


def hash_password(plaintext: str) -> str:
    raise NotImplementedError("Implement in the auth feature.")


def verify_password(plaintext: str, hashed: str) -> bool:
    raise NotImplementedError("Implement in the auth feature.")
