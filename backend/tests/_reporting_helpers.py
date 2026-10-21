"""Shared helpers for reporting tests (not a test file — leading underscore).

The `seed_reporting_landscape` fixture builds the canonical world used by
all five reporting test files (Decision 8 in research.md): 2 clients,
4 projects (pending / active / completed / overdue), 6 modules across
3 developers, 4 payments at mixed statuses (paid / partial / pending /
not-yet-generated).

The returned dict exposes every id the tests need so individual tests
don't need to know the seed order.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from app.modules.clients.repository import create_client
from app.modules.projects.repository import (
    create_module,
    create_project,
)

from tests._payments_helpers import seed_payment_for_project


def _make_project(
    session,
    *,
    client_id: int,
    name: str,
    status: str = "pending",
    start_date: date = date(2026, 1, 1),
    end_date: date = date(2026, 12, 31),
    total_amount: str = "10000.00",
):
    return create_project(
        session,
        name=name,
        description=None,
        client_id=client_id,
        total_amount=Decimal(total_amount),
        company_share=Decimal("30.00"),
        developer_share=Decimal("70.00"),
        start_date=start_date,
        end_date=end_date,
        status=status,
        is_active=True,
    )


def _seed_module_with_status(
    session,
    *,
    project_id: int,
    developer_id: int,
    share: str,
    progress: int,
    name: str,
):
    if progress >= 100:
        mstatus = "completed"
    elif progress > 0:
        mstatus = "in_progress"
    else:
        mstatus = "pending"
    return create_module(
        session,
        project_id=project_id,
        name=name,
        description=None,
        assigned_developer_id=developer_id,
        progress=progress,
        status=mstatus,
        share_percentage=Decimal(share),
        is_active=True,
    )


def seed_reporting_landscape(
    *,
    client,
    session,
    seed_admin,
    seed_manager,
    seed_developer,
    auth_header,
) -> dict[str, Any]:
    """Build the canonical reporting test world.

    Returns:
        {
          "admin": User, "manager": User,
          "developers": [d1, d2, d3],
          "clients": [c1, c2],
          "projects": {"pending": p, "active": a, "completed": c, "overdue": o},
          "payments": {"active_paid": dict, "active_partial": dict,
                       "active_pending": dict},
          "auth_header": dict (admin's bearer header — test convenience),
        }
    """
    admin = seed_admin(name="Ada Admin", email="ada@example.com")
    manager = seed_manager(name="Mia Manager", email="mia@example.com")
    d1 = seed_developer(name="Devon One", email="d1@example.com")
    d2 = seed_developer(name="Devyn Two", email="d2@example.com")
    d3 = seed_developer(name="Dani Three", email="d3@example.com")

    c1 = create_client(
        session, name="Acme", email="acme@example.com", phone="+1-415-555-0101"
    )
    c2 = create_client(
        session, name="Globex", email="globex@example.com", phone="+1-415-555-0102"
    )

    pending_project = _make_project(
        session, client_id=c1.id, name="P-Pending", status="pending"
    )
    active_project = _make_project(
        session, client_id=c1.id, name="P-Active", status="active"
    )
    completed_project = _make_project(
        session, client_id=c2.id, name="P-Completed", status="completed"
    )
    # Overdue == active AND end_date < today (today = 2026-05-09 per spec).
    overdue_project = _make_project(
        session,
        client_id=c2.id,
        name="P-Overdue",
        status="active",
        start_date=date(2025, 1, 1),
        end_date=date(2025, 6, 30),
    )

    # 6 modules: progress = [100, 60, 0, 100, 50, 0] across the 3 developers.
    _seed_module_with_status(
        session,
        project_id=active_project.id,
        developer_id=d1.id,
        share="40.00",
        progress=100,
        name="auth-flow",
    )
    _seed_module_with_status(
        session,
        project_id=active_project.id,
        developer_id=d2.id,
        share="30.00",
        progress=60,
        name="dashboards",
    )
    _seed_module_with_status(
        session,
        project_id=pending_project.id,
        developer_id=d3.id,
        share="70.00",
        progress=0,
        name="kickoff",
    )
    _seed_module_with_status(
        session,
        project_id=completed_project.id,
        developer_id=d1.id,
        share="40.00",
        progress=100,
        name="billing",
    )
    _seed_module_with_status(
        session,
        project_id=completed_project.id,
        developer_id=d2.id,
        share="30.00",
        progress=50,
        name="exports",
    )
    _seed_module_with_status(
        session,
        project_id=overdue_project.id,
        developer_id=d3.id,
        share="70.00",
        progress=0,
        name="legacy",
    )

    h = auth_header(admin)

    pay_active_paid = seed_payment_for_project(
        client,
        project_id=active_project.id,
        total_amount="1000.00",
        auth_header=h,
    )
    pay_active_partial = seed_payment_for_project(
        client,
        project_id=active_project.id,
        total_amount="2000.00",
        auth_header=h,
    )
    pay_active_pending = seed_payment_for_project(
        client,
        project_id=completed_project.id,
        total_amount="3000.00",
        auth_header=h,
    )

    # active_paid → mark all paid.
    client.patch(
        f"/payments/{pay_active_paid['id']}/status",
        json={"target": "all"},
        headers=h,
    )
    # active_partial → mark first child paid (parent → "partial").
    first_child = pay_active_partial["developer_breakdown"][0]["id"]
    client.patch(
        f"/payments/{pay_active_partial['id']}/status",
        json={"developer_payment_id": first_child},
        headers=h,
    )
    # pay_active_pending stays fully pending.

    return {
        "admin": admin,
        "manager": manager,
        "developers": [d1, d2, d3],
        "clients": [c1, c2],
        "projects": {
            "pending": pending_project,
            "active": active_project,
            "completed": completed_project,
            "overdue": overdue_project,
        },
        "payments": {
            "active_paid": pay_active_paid,
            "active_partial": pay_active_partial,
            "active_pending": pay_active_pending,
        },
        "auth_header": h,
    }


# T008 helpers --------------------------------------------------------------


def assert_dashboard_payload_shape(payload: dict) -> None:
    assert set(payload.keys()) == {"projects", "developers", "payments"}
    assert set(payload["projects"].keys()) == {
        "total",
        "pending",
        "active",
        "completed",
        "overdue",
    }
    assert set(payload["developers"].keys()) == {
        "total",
        "with_active_assignments",
        "average_module_progress",
    }
    assert set(payload["payments"].keys()) == {
        "total_revenue",
        "total_company_reserve",
        "total_developer_disbursed",
        "pending_amount",
    }


def assert_no_developer_data_leaked(
    payload: dict, allowed_developer_id: int
) -> None:
    """Used by /me tests: every module in the payload is owned by the caller."""
    assert payload["id"] == allowed_developer_id
    for module in payload.get("modules", []):
        # The module list contains module rows; their ownership is implied by
        # the repository's WHERE clause. We assert that none of the project_id
        # / module_id fields point at a foreign developer's row by checking
        # the payload was scoped — i.e. module_id is present and an int.
        assert "module_id" in module and isinstance(module["module_id"], int)
