"""US5: GET /payments/summary — aggregate sums and by_status buckets."""

from __future__ import annotations

from decimal import Decimal

from tests._payments_helpers import seed_payment_for_project
from tests._projects_helpers import (
    seed_active_client,
    seed_active_project,
    seed_module,
)


def _seed_three_payments_mixed_status(
    session, client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    h = auth_header(admin)
    cl = seed_active_client(session)
    p1 = seed_active_project(session, client_id=cl.id, name="P1")
    p2 = seed_active_project(session, client_id=cl.id, name="P2")
    a = seed_developer(name="A", email="a@example.com")
    b = seed_developer(name="B", email="b@example.com")
    seed_module(session, project_id=p1.id, developer_id=a.id, share="40.00", name="m1")
    seed_module(session, project_id=p1.id, developer_id=b.id, share="30.00", name="m2")
    seed_module(session, project_id=p2.id, developer_id=a.id, share="70.00", name="m3")
    pay1 = seed_payment_for_project(
        client, project_id=p1.id, total_amount="1000.00", auth_header=h
    )  # → fully paid
    pay2 = seed_payment_for_project(
        client, project_id=p1.id, total_amount="2000.00", auth_header=h
    )  # → partial
    seed_payment_for_project(
        client, project_id=p2.id, total_amount="3000.00", auth_header=h
    )  # → pending
    # pay1: mark all paid
    client.patch(
        f"/payments/{pay1['id']}/status", json={"target": "all"}, headers=h
    )
    # pay2: mark first child paid → partial
    first_child = pay2["developer_breakdown"][0]["id"]
    client.patch(
        f"/payments/{pay2['id']}/status",
        json={"developer_payment_id": first_child},
        headers=h,
    )
    return admin


def test_admin_summary_with_mixed_status(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = _seed_three_payments_mixed_status(
        session, client, seed_admin, seed_developer, auth_header
    )
    admin2 = seed_admin(email="admin2@example.com")
    response = client.get("/payments/summary", headers=auth_header(admin2))
    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_billed"]) == Decimal("6000.00")
    assert Decimal(body["total_company_reserve"]) == Decimal("1800.00")
    assert Decimal(body["total_developer_disbursed"]) == Decimal("4200.00")
    assert body["by_status"]["paid"]["count"] == 1
    assert body["by_status"]["partial"]["count"] == 1
    assert body["by_status"]["pending"]["count"] == 1
    assert Decimal(body["by_status"]["paid"]["sum"]) == Decimal("1000.00")
    assert Decimal(body["by_status"]["partial"]["sum"]) == Decimal("2000.00")
    assert Decimal(body["by_status"]["pending"]["sum"]) == Decimal("3000.00")


def test_manager_can_read_summary(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    _seed_three_payments_mixed_status(
        session, client, seed_admin, seed_developer, auth_header
    )
    manager = seed_manager()
    response = client.get("/payments/summary", headers=auth_header(manager))
    assert response.status_code == 200


def test_developer_cannot_read_summary(
    client, session, seed_admin, seed_developer, auth_header
):
    _seed_three_payments_mixed_status(
        session, client, seed_admin, seed_developer, auth_header
    )
    dev = seed_developer(name="C", email="c@example.com")
    response = client.get("/payments/summary", headers=auth_header(dev))
    assert response.status_code == 403


def test_empty_system_summary_zeros(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.get("/payments/summary", headers=auth_header(admin))
    assert response.status_code == 200
    body = response.json()
    assert Decimal(body["total_billed"]) == Decimal("0.00")
    assert body["by_status"]["pending"]["count"] == 0
    assert body["by_status"]["partial"]["count"] == 0
    assert body["by_status"]["paid"]["count"] == 0


def test_unauth_summary_returns_401(client):
    response = client.get("/payments/summary")
    assert response.status_code == 401
