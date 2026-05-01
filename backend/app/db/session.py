"""Database engine and session lifecycle. Engine is lazy so import-time has no DB dependency."""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlmodel import Session, create_engine
from sqlalchemy.engine import Engine

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
