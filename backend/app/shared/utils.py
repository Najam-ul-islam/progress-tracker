"""Cross-cutting helpers used by multiple modules. No business logic, no DB or HTTP imports."""

from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)
