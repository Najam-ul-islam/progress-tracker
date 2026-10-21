"""Clients module: all business logic. The only legal home for domain rules.

Routes call into this module; this module calls `clients.repository` for
persistence and raises typed exceptions that the routes layer translates into
the HTTP responses documented in `contracts/openapi.yaml`.
"""

from __future__ import annotations

import logging

from typing import Any

from sqlmodel import Session

from app.modules.clients import repository as clients_repo
from app.modules.clients.schema import ClientCreate, ClientRead, ClientUpdate


logger = logging.getLogger(__name__)


class ClientNotFoundError(Exception):
    """Target client id does not exist or is soft-deleted (FR-019 → HTTP 404)."""


class DuplicateClientError(Exception):
    """A uniqueness collision was detected on email or phone (FR-009 / FR-010 → HTTP 409).

    Carries `.field` in {"email", "phone"} so the route emits the right detail.
    """

    def __init__(self, *, field: str) -> None:
        super().__init__(f"client with this {field} already exists")
        self.field = field


def create_client(
    session: Session, *, payload: ClientCreate, requester: Any
) -> ClientRead:
    """Create a new client. Proactively rejects duplicate email/phone among
    active rows (FR-009); the partial unique indexes are the ultimate guard
    against races (research.md R1)."""
    if clients_repo.find_active_client_by_email(session, payload.email) is not None:
        logger.info(
            "clients.create_client: duplicate email guard fired requester_id=%s",
            requester.id,
        )
        raise DuplicateClientError(field="email")
    if clients_repo.find_active_client_by_phone(session, payload.phone) is not None:
        logger.info(
            "clients.create_client: duplicate phone guard fired requester_id=%s",
            requester.id,
        )
        raise DuplicateClientError(field="phone")

    client = clients_repo.create_client(session, **payload.model_dump())
    logger.info("clients.create_client: client_id=%s created", client.id)
    return ClientRead.model_validate(client)


def get_client(session: Session, *, client_id: int) -> ClientRead:
    """Fetch a single client by id. Soft-deleted rows are invisible (FR-014 / FR-019)."""
    client = clients_repo.get_client_by_id(session, client_id)
    if client is None:
        raise ClientNotFoundError(client_id)
    return ClientRead.model_validate(client)


def list_clients(session: Session) -> list[ClientRead]:
    """Return every active client. Admin/manager-gated at the route."""
    return [
        ClientRead.model_validate(c) for c in clients_repo.list_clients(session)
    ]


def update_client(
    session: Session, *, client_id: int, patch: ClientUpdate
) -> ClientRead:
    """Patch one or more fields on a client. Enforces FR-010 cross-row uniqueness
    on `email` and `phone` (excluding the target's own id)."""
    client = clients_repo.get_client_by_id(session, client_id)
    if client is None:
        raise ClientNotFoundError(client_id)

    fields = patch.model_dump(exclude_unset=True)

    if "email" in fields:
        existing = clients_repo.find_active_client_by_email(session, fields["email"])
        if existing is not None and existing.id != client_id:
            logger.info(
                "clients.update_client: duplicate email guard fired client_id=%s",
                client_id,
            )
            raise DuplicateClientError(field="email")
    if "phone" in fields:
        existing = clients_repo.find_active_client_by_phone(session, fields["phone"])
        if existing is not None and existing.id != client_id:
            logger.info(
                "clients.update_client: duplicate phone guard fired client_id=%s",
                client_id,
            )
            raise DuplicateClientError(field="phone")

    client = clients_repo.update_client(session, client, **fields)
    logger.info(
        "clients.update_client: client_id=%s changed=%s",
        client.id,
        list(fields.keys()),
    )
    return ClientRead.model_validate(client)


def delete_client(session: Session, *, client_id: int) -> None:
    """Soft-delete: flip `is_active = False` and bump `updated_at` (FR-012 / FR-014).
    A re-delete of an already-soft-deleted row surfaces as 404 because the
    repository lookup filters by `is_active = TRUE`."""
    client = clients_repo.get_client_by_id(session, client_id)
    if client is None:
        raise ClientNotFoundError(client_id)
    clients_repo.soft_delete_client(session, client)
    logger.info("clients.delete_client: client_id=%s soft-deleted", client_id)


__all__ = [
    "ClientNotFoundError",
    "DuplicateClientError",
    "create_client",
    "get_client",
    "list_clients",
    "update_client",
    "delete_client",
]
