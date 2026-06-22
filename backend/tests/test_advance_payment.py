from decimal import Decimal
from datetime import date
from app.modules.projects.repository import create_project, create_module
from app.modules.clients.repository import create_client
from app.modules.payments.repository import list_payments

def test_advance_payment_requirement(client, session, seed_admin, auth_header, seed_developer):
    admin = seed_admin()
    dev = seed_developer()
    h = auth_header(admin)

    c1 = create_client(session, name="Acme", email="acme@example.com", phone="123")
    session.commit()

    # 1. Create a project
    project = create_project(
        session,
        name="Advance Req Project",
        description=None,
        client_id=c1.id,
        total_amount=Decimal("1000.00"),
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        status="pending"
    )

    # 2. Add modules summing to 70%
    create_module(session, project_id=project.id, name="M1", assigned_developer_id=dev.id, share_percentage=Decimal("70.00"), progress=0)
    session.commit()

    # 3. Try to activate without payment (should fail)
    response = client.patch(f"/projects/{project.id}", json={"status": "active"}, headers=h)
    assert response.status_code == 422
    assert "30% advance payment required" in response.text

    # 4. Generate a 30% advance ($300 — the minimum)
    client.post(f"/payments/generate/{project.id}", json={"total_amount": 300}, headers=h)

    # 5. Try to activate with pending payment (should still fail — must be paid)
    response = client.patch(f"/projects/{project.id}", json={"status": "active"}, headers=h)
    assert response.status_code == 422
    assert "30% advance payment required" in response.text

    # 6. Mark payment as paid
    payment = list_payments(session, project_id=project.id)[0]
    client.patch(f"/payments/{payment.id}/status", json={"target": "all"}, headers=h)

    # 7. Now activate should succeed (30% paid meets the floor)
    response = client.patch(f"/projects/{project.id}", json={"status": "active"}, headers=h)
    assert response.status_code == 200
    assert response.json()["status"] == "active"


def test_advance_below_30_percent_fails(client, session, seed_admin, auth_header, seed_developer):
    """29% paid → activation rejected (just below the 30% floor)."""
    admin = seed_admin()
    dev = seed_developer()
    h = auth_header(admin)

    c1 = create_client(session, name="Bravo", email="bravo@example.com", phone="123")
    session.commit()

    project = create_project(
        session,
        name="Below Floor Project",
        description=None,
        client_id=c1.id,
        total_amount=Decimal("1000.00"),
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        status="pending",
    )
    create_module(session, project_id=project.id, name="M1", assigned_developer_id=dev.id, share_percentage=Decimal("70.00"), progress=0)
    session.commit()

    # Pay $290 (29%) and mark paid.
    client.post(f"/payments/generate/{project.id}", json={"total_amount": 290}, headers=h)
    payment = list_payments(session, project_id=project.id)[0]
    client.patch(f"/payments/{payment.id}/status", json={"target": "all"}, headers=h)

    response = client.patch(f"/projects/{project.id}", json={"status": "active"}, headers=h)
    assert response.status_code == 422
    assert "30% advance payment required" in response.text


def test_advance_above_50_percent_still_activates(client, session, seed_admin, auth_header, seed_developer):
    """Paying more than 50% up front must NOT block activation (no upper cap at the gate)."""
    admin = seed_admin()
    dev = seed_developer()
    h = auth_header(admin)

    c1 = create_client(session, name="Charlie", email="charlie@example.com", phone="123")
    session.commit()

    project = create_project(
        session,
        name="Overpaid Project",
        description=None,
        client_id=c1.id,
        total_amount=Decimal("1000.00"),
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        status="pending",
    )
    create_module(session, project_id=project.id, name="M1", assigned_developer_id=dev.id, share_percentage=Decimal("70.00"), progress=0)
    session.commit()

    # Pay $600 (60%) and mark paid.
    client.post(f"/payments/generate/{project.id}", json={"total_amount": 600}, headers=h)
    payment = list_payments(session, project_id=project.id)[0]
    client.patch(f"/payments/{payment.id}/status", json={"target": "all"}, headers=h)

    response = client.patch(f"/projects/{project.id}", json={"status": "active"}, headers=h)
    assert response.status_code == 200
    assert response.json()["status"] == "active"
