"""Clients module: all database queries. No business logic, no HTTP concerns.

This is the only legal home for SQL against the `client` table (FR-001 / FR-003).
Each helper is a single statement; uniqueness collisions raised by the partial
unique indexes (`ix_client_email_active`, `ix_client_phone_active`) are
translated into `DuplicateClientError` so the service layer always sees the
same shape whether the duplicate was caught proactively or by the DB
(research.md R4).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.modules.clients.model import Client


def _raise_duplicate_from_integrity_error(exc: IntegrityError) -> None:
    """Translate a partial-unique-index violation into DuplicateClientError.

    Imported at function scope to avoid the circular import
    `repository -> service -> repository`.
    """
    from app.modules.clients.service import DuplicateClientError

    message = str(exc.orig) if exc.orig is not None else str(exc)
    if "ix_client_email_active" in message or "client.email" in message:
        raise DuplicateClientError(field="email") from exc
    if "ix_client_phone_active" in message or "client.phone" in message:
        raise DuplicateClientError(field="phone") from exc
    # Unknown integrity violation — re-raise so callers see the original error
    # rather than silently mapping it to a uniqueness conflict.
    raise


def create_client(session: Session, **fields: Any) -> Client:
    client = Client(**fields)
    session.add(client)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        _raise_duplicate_from_integrity_error(exc)
    session.refresh(client)
    return client


def get_client_by_id(session: Session, client_id: int) -> Client | None:
    statement = (
        select(Client)
        .where(Client.id == client_id, Client.is_active == True)  # noqa: E712
        .limit(1)
    )
    return session.exec(statement).first()


def list_clients(session: Session) -> list[Client]:
    statement = (
        select(Client)
        .where(Client.is_active == True)  # noqa: E712
        .order_by(Client.id)
    )
    return list(session.exec(statement).all())


def find_active_client_by_email(
    session: Session, email: str
) -> Client | None:
    statement = (
        select(Client)
        .where(Client.email == email, Client.is_active == True)  # noqa: E712
        .limit(1)
    )
    return session.exec(statement).first()


def find_active_client_by_phone(
    session: Session, phone: str
) -> Client | None:
    statement = (
        select(Client)
        .where(Client.phone == phone, Client.is_active == True)  # noqa: E712
        .limit(1)
    )
    return session.exec(statement).first()


def update_client(
    session: Session, client: Client, **fields: Any
) -> Client:
    for key, value in fields.items():
        setattr(client, key, value)
    client.updated_at = datetime.now(timezone.utc)
    session.add(client)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        _raise_duplicate_from_integrity_error(exc)
    session.refresh(client)
    return client


def soft_delete_client(session: Session, client: Client) -> None:
    client.is_active = False
    client.updated_at = datetime.now(timezone.utc)
    session.add(client)
    session.commit()
