"""Clients module: HTTP routing only. Delegates to services.

No business logic, no DB access. Endpoints translate service-level exceptions
into the canonical HTTP responses defined in
`specs/004-clients-management/contracts/openapi.yaml`. Role gating is enforced
exclusively via `auth.dependencies.{require_admin, require_any}`.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.db.session import get_session
from app.modules.auth.dependencies import require_admin, require_any
from app.modules.clients import service as clients_service
from app.modules.clients.schema import ClientCreate, ClientRead, ClientUpdate


router = APIRouter(tags=["clients"])

_NOT_FOUND = "Client not found"


@router.post(
    "", response_model=ClientRead, status_code=status.HTTP_201_CREATED
)
def create_client(
    payload: ClientCreate,
    session: Session = Depends(get_session),
    requester: Any = Depends(require_any("admin", "manager")),
) -> ClientRead:
    try:
        return clients_service.create_client(
            session, payload=payload, requester=requester
        )
    except clients_service.DuplicateClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"client with this {exc.field} already exists",
        )


@router.get("", response_model=list[ClientRead])
def list_clients(
    session: Session = Depends(get_session),
    _: Any = Depends(require_any("admin", "manager")),
) -> list[ClientRead]:
    return clients_service.list_clients(session)


@router.get("/{id}", response_model=ClientRead)
def get_client_by_id(
    id: int,
    session: Session = Depends(get_session),
    _: Any = Depends(require_any("admin", "manager")),
) -> ClientRead:
    try:
        return clients_service.get_client(session, client_id=id)
    except clients_service.ClientNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND
        )


@router.patch("/{id}", response_model=ClientRead)
def update_client(
    id: int,
    patch: ClientUpdate,
    session: Session = Depends(get_session),
    _: Any = Depends(require_any("admin", "manager")),
) -> ClientRead:
    try:
        return clients_service.update_client(
            session, client_id=id, patch=patch
        )
    except clients_service.ClientNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND
        )
    except clients_service.DuplicateClientError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"client with this {exc.field} already exists",
        )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    id: int,
    session: Session = Depends(get_session),
    _: Any = Depends(require_admin),
) -> None:
    try:
        clients_service.delete_client(session, client_id=id)
    except clients_service.ClientNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND
        )
