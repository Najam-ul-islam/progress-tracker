"""Notification trigger tests for projects module.

Verifies that:
- create_module fires an 'assignment' notification for the assigned developer.
- update_module fires an 'assignment' notification only when the assignee changes.
- update_module_progress fires a 'progress_update' notification for all active admins.
- A notification failure never rolls back the primary operation.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import patch

from sqlmodel import select

from app.modules.clients.repository import create_client
from app.modules.notifications.model import Notification
from app.modules.projects.repository import create_module, create_project
from app.modules.projects.model import ProjectModule
from app.modules.users.repository import create_user
from tests._projects_helpers import seed_active_client, seed_pending_project


def _seed_project(session, client_id: int):
    return create_project(
        session,
        name="Test Project",
        description=None,
        client_id=client_id,
        total_amount=Decimal("10000.00"),
        company_share=Decimal("30.00"),
        developer_share=Decimal("70.00"),
        start_date=date(2026, 6, 1),
        end_date=date(2026, 8, 31),
        status="active",
        is_active=True,
    )


def test_create_module_creates_assignment_notification(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    p = _seed_project(session, c.id)

    r = client.post(
        f"/projects/{p.id}/modules",
        json={
            "name": "Auth slice",
            "assigned_developer_id": dev.id,
            "share_percentage": 30,
        },
        headers=auth_header(admin),
    )
    assert r.status_code == 201

    rows = session.exec(
        select(Notification).where(Notification.user_id == dev.id)
    ).all()
    assert len(rows) == 1
    assert rows[0].type == "assignment"
    assert "Auth slice" in rows[0].title
    assert "Test Project" in rows[0].message


def test_update_module_reassign_creates_assignment_notification(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev1 = seed_developer(email="dev1@example.com")
    dev2 = seed_developer(email="dev2@example.com")
    c = seed_active_client(session)
    p = _seed_project(session, c.id)
    m = create_module(
        session,
        project_id=p.id,
        name="Module",
        description=None,
        assigned_developer_id=dev1.id,
        progress=0,
        status="pending",
        share_percentage=Decimal("30.00"),
        is_active=True,
    )

    r = client.patch(
        f"/modules/{m.id}",
        json={"assigned_developer_id": dev2.id},
        headers=auth_header(admin),
    )
    assert r.status_code == 200

    rows = session.exec(
        select(Notification).where(Notification.user_id == dev2.id)
    ).all()
    assert len(rows) == 1
    assert rows[0].type == "assignment"
    assert "Module" in rows[0].title

    # Dev1 should NOT receive a notification
    rows_dev1 = session.exec(
        select(Notification).where(Notification.user_id == dev1.id)
    ).all()
    assert len(rows_dev1) == 0


def test_update_module_same_assignee_no_duplicate_notification(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    p = _seed_project(session, c.id)
    m = create_module(
        session,
        project_id=p.id,
        name="Module",
        description=None,
        assigned_developer_id=dev.id,
        progress=0,
        status="pending",
        share_percentage=Decimal("30.00"),
        is_active=True,
    )

    r = client.patch(
        f"/modules/{m.id}",
        json={"name": "Renamed Module"},
        headers=auth_header(admin),
    )
    assert r.status_code == 200

    rows = session.exec(
        select(Notification).where(Notification.user_id == dev.id)
    ).all()
    assert len(rows) == 0


def test_update_module_progress_creates_admin_notification(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    p = _seed_project(session, c.id)
    m = create_module(
        session,
        project_id=p.id,
        name="Module",
        description=None,
        assigned_developer_id=dev.id,
        progress=0,
        status="pending",
        share_percentage=Decimal("30.00"),
        is_active=True,
    )

    r = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 75},
        headers=auth_header(dev),
    )
    assert r.status_code == 200

    rows = session.exec(
        select(Notification).where(
            Notification.user_id == admin.id,
            Notification.type == "progress_update",
        )
    ).all()
    assert len(rows) == 1
    assert "75%" in rows[0].message
    assert "Module" in rows[0].message
    assert "Test Project" in rows[0].message


def test_notification_failure_does_not_rollback_assignment(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    p = _seed_project(session, c.id)

    with patch(
        "app.modules.notifications.service.publish",
        side_effect=RuntimeError("SMTP down"),
    ):
        r = client.post(
            f"/projects/{p.id}/modules",
            json={
                "name": "Critical Module",
                "assigned_developer_id": dev.id,
                "share_percentage": 30,
            },
            headers=auth_header(admin),
        )
    assert r.status_code == 201

    module_rows = session.exec(
        select(ProjectModule).where(ProjectModule.project_id == p.id)
    ).all()
    assert len(module_rows) == 1
    assert module_rows[0].name == "Critical Module"

    notification_rows = session.exec(
        select(Notification).where(Notification.user_id == dev.id)
    ).all()
    assert len(notification_rows) == 0


def test_notification_failure_does_not_rollback_progress_update(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    p = _seed_project(session, c.id)
    m = create_module(
        session,
        project_id=p.id,
        name="Module",
        description=None,
        assigned_developer_id=dev.id,
        progress=0,
        status="pending",
        share_percentage=Decimal("30.00"),
        is_active=True,
    )

    with patch(
        "app.modules.notifications.service.publish",
        side_effect=RuntimeError("SMTP down"),
    ):
        r = client.patch(
            f"/modules/{m.id}/progress",
            json={"progress": 50},
            headers=auth_header(dev),
        )
    assert r.status_code == 200

    module_rows = session.exec(
        select(ProjectModule).where(ProjectModule.id == m.id)
    ).all()
    assert module_rows[0].progress == 50

    notification_rows = session.exec(
        select(Notification).where(
            Notification.user_id == admin.id,
            Notification.type == "progress_update",
        )
    ).all()
    assert len(notification_rows) == 0
