"""Payment notification trigger tests.

Verifies that:
- generate_payment_distribution fires a 'payment' notification for each affected developer.
- update_payment_status fires a 'payment_paid' notification only for developers whose
  payment actually flipped pending -> paid.
- Notification payloads never expose total_project_amount, company_reserve, or
  another developer's amount (scoped visibility).
- A notification failure never rolls back the underlying payment operation.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import patch

from sqlmodel import select

from app.modules.clients.repository import create_client
from app.modules.notifications.model import Notification
from app.modules.payments.service import generate_payment_distribution
from app.modules.projects.repository import create_module, create_project
from app.modules.users.repository import create_user
from tests._projects_helpers import seed_active_client


def _seed_project_and_modules(session, client_id: int, dev1_id: int, dev2_id: int | None = None):
    if dev2_id is None:
        dev2 = create_user(
            session,
            name="Dev Two",
            email="dev2@example.com",
            password_hash="hash",
            role="developer",
        )
        dev2_id = dev2.id
    p = create_project(
        session,
        name="Billing Project",
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
    m1 = create_module(
        session,
        project_id=p.id,
        name="Frontend",
        description=None,
        assigned_developer_id=dev1_id,
        progress=100,
        status="completed",
        share_percentage=Decimal("35.00"),
        is_active=True,
    )
    m2 = create_module(
        session,
        project_id=p.id,
        name="Backend",
        description=None,
        assigned_developer_id=dev2_id,
        progress=100,
        status="completed",
        share_percentage=Decimal("35.00"),
        is_active=True,
    )
    return p, m1, m2


def test_generate_payment_creates_payment_notification_for_each_developer(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev1 = seed_developer(email="dev1@example.com")
    dev2 = seed_developer(email="dev2@example.com")
    c = seed_active_client(session)
    _seed_project_and_modules(session, c.id, dev1.id, dev2.id)

    r = client.post(
        "/payments/generate/1",
        json={"total_amount": "10000.00"},
        headers=auth_header(admin),
    )
    assert r.status_code == 201
    body = r.json()
    payment_id = body["id"]

    dev1_rows = session.exec(
        select(Notification).where(Notification.user_id == dev1.id)
    ).all()
    assert len(dev1_rows) == 1
    assert dev1_rows[0].type == "payment"
    assert "Frontend" in dev1_rows[0].message
    assert "Billing Project" in dev1_rows[0].message
    assert "3500.00" in dev1_rows[0].message

    dev2_rows = session.exec(
        select(Notification).where(Notification.user_id == dev2.id)
    ).all()
    assert len(dev2_rows) == 1
    assert dev2_rows[0].type == "payment"
    assert "Backend" in dev2_rows[0].message
    assert "3500.00" in dev2_rows[0].message


def test_generate_payment_notification_no_total_or_reserve_exposure(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    _seed_project_and_modules(session, c.id, dev.id)

    r = client.post(
        "/payments/generate/1",
        json={"total_amount": "10000.00"},
        headers=auth_header(admin),
    )
    assert r.status_code == 201

    rows = session.exec(
        select(Notification).where(Notification.user_id == dev.id, Notification.type == "payment")
    ).all()
    assert len(rows) == 1
    title = rows[0].title
    message = rows[0].message
    assert "10000.00" not in title + message
    assert "3000.00" not in title + message
    assert "7000.00" not in title + message  # developer pool total


def test_update_payment_status_creates_payment_paid_notification(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    _seed_project_and_modules(session, c.id, dev.id)

    r = client.post(
        "/payments/generate/1",
        json={"total_amount": "10000.00"},
        headers=auth_header(admin),
    )
    assert r.status_code == 201
    payment_id = r.json()["id"]

    r = client.patch(
        f"/payments/{payment_id}/status",
        json={"developer_payment_id": 1},
        headers=auth_header(admin),
    )
    assert r.status_code == 200

    rows = session.exec(
        select(Notification).where(Notification.user_id == dev.id, Notification.type == "payment_paid")
    ).all()
    assert len(rows) == 1
    assert "released" in rows[0].message.lower()
    assert "Frontend" in rows[0].message
    assert "Billing Project" in rows[0].message
    assert "3500.00" in rows[0].message


def test_update_payment_status_no_duplicate_on_already_paid(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    _seed_project_and_modules(session, c.id, dev.id)

    r = client.post(
        "/payments/generate/1",
        json={"total_amount": "10000.00", "mark_as_paid": True},
        headers=auth_header(admin),
    )
    assert r.status_code == 201
    payment_id = r.json()["id"]

    # Child 1 is already paid from generation; patch again should NOT create duplicate
    r = client.patch(
        f"/payments/{payment_id}/status",
        json={"developer_payment_id": 1},
        headers=auth_header(admin),
    )
    assert r.status_code == 200

    rows = session.exec(
        select(Notification).where(Notification.user_id == dev.id, Notification.type == "payment_paid")
    ).all()
    assert len(rows) == 0


def test_update_payment_status_target_all_notifies_all_pending(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev1 = seed_developer(email="dev1@example.com")
    dev2 = seed_developer(email="dev2@example.com")
    c = seed_active_client(session)
    _seed_project_and_modules(session, c.id, dev1.id, dev2.id)

    r = client.post(
        "/payments/generate/1",
        json={"total_amount": "10000.00"},
        headers=auth_header(admin),
    )
    assert r.status_code == 201
    payment_id = r.json()["id"]

    r = client.patch(
        f"/payments/{payment_id}/status",
        json={"target": "all"},
        headers=auth_header(admin),
    )
    assert r.status_code == 200

    rows1 = session.exec(
        select(Notification).where(Notification.user_id == dev1.id, Notification.type == "payment_paid")
    ).all()
    assert len(rows1) == 1

    rows2 = session.exec(
        select(Notification).where(Notification.user_id == dev2.id, Notification.type == "payment_paid")
    ).all()
    assert len(rows2) == 1


def test_payment_notification_failure_does_not_rollback_generate(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    _seed_project_and_modules(session, c.id, dev.id)

    with patch(
        "app.modules.notifications.service.publish",
        side_effect=RuntimeError("SMTP down"),
    ):
        r = client.post(
            "/payments/generate/1",
            json={"total_amount": "10000.00"},
            headers=auth_header(admin),
        )
    assert r.status_code == 201
    body = r.json()
    assert body["id"] is not None


def test_payment_notification_failure_does_not_rollback_status_patch(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(email="dev1@example.com")
    c = seed_active_client(session)
    _seed_project_and_modules(session, c.id, dev.id)

    r = client.post(
        "/payments/generate/1",
        json={"total_amount": "10000.00"},
        headers=auth_header(admin),
    )
    assert r.status_code == 201
    payment_id = r.json()["id"]

    with patch(
        "app.modules.notifications.service.publish",
        side_effect=RuntimeError("SMTP down"),
    ):
        r = client.patch(
            f"/payments/{payment_id}/status",
            json={"developer_payment_id": 1},
            headers=auth_header(admin),
        )
    assert r.status_code == 200

    rows = session.exec(
        select(Notification).where(Notification.user_id == dev.id, Notification.type == "payment_paid")
    ).all()
    assert len(rows) == 0
