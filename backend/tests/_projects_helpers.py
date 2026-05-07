"""Shared helpers for projects/modules tests (not a test file — leading underscore)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.modules.clients.repository import create_client
from app.modules.projects.repository import create_module, create_project


def seed_active_client(session, *, email: str = "acme@example.com"):
    return create_client(
        session, name="Acme", email=email, phone="+1-415-555-0101"
    )


def seed_pending_project(session, *, client_id: int, name: str = "P"):
    return create_project(
        session,
        name=name,
        description=None,
        client_id=client_id,
        total_amount=Decimal("10000.00"),
        company_share=Decimal("30.00"),
        developer_share=Decimal("70.00"),
        start_date=date(2026, 6, 1),
        end_date=date(2026, 8, 31),
        status="pending",
        is_active=True,
    )


def seed_active_project(session, *, client_id: int, name: str = "P"):
    p = seed_pending_project(session, client_id=client_id, name=name)
    p.status = "active"
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def seed_module(
    session,
    *,
    project_id: int,
    developer_id: int,
    share: str = "30.00",
    progress: int = 0,
    name: str = "m",
):
    return create_module(
        session,
        project_id=project_id,
        name=name,
        description=None,
        assigned_developer_id=developer_id,
        progress=progress,
        status="pending"
        if progress == 0
        else ("completed" if progress == 100 else "in_progress"),
        share_percentage=Decimal(share),
        is_active=True,
    )
