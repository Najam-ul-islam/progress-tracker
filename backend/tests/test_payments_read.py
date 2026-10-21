"""US2: GET /payments and GET /payments/{id} — admin/manager read; developer denied."""

from __future__ import annotations

from tests._payments_helpers import seed_payment_for_project
from tests._projects_helpers import (
    seed_active_client,
    seed_active_project,
    seed_module,
)


def _seed_two_projects_with_payments(
    session, client, seed_admin, seed_developer, auth_header
):
    """Seed 2 active projects, generate 2 payments on p1 + 1 on p2 → 3 Payments."""
    admin = seed_admin()
    h = auth_header(admin)
    client_row = seed_active_client(session)
    p1 = seed_active_project(session, client_id=client_row.id, name="P1")
    p2 = seed_active_project(session, client_id=client_row.id, name="P2")
    dev_a = seed_developer(name="A", email="a@example.com")
    dev_b = seed_developer(name="B", email="b@example.com")
    seed_module(
        session, project_id=p1.id, developer_id=dev_a.id, share="40.00", name="m1"
    )
    seed_module(
        session, project_id=p1.id, developer_id=dev_b.id, share="30.00", name="m2"
    )
    seed_module(
        session, project_id=p2.id, developer_id=dev_a.id, share="70.00", name="m3"
    )
    pay1 = seed_payment_for_project(
        client, project_id=p1.id, total_amount="1000.00", auth_header=h
    )
    pay2 = seed_payment_for_project(
        client, project_id=p1.id, total_amount="2000.00", auth_header=h
    )
    pay3 = seed_payment_for_project(
        client, project_id=p2.id, total_amount="3000.00", auth_header=h
    )
    return p1, p2, [pay1, pay2, pay3]


def test_admin_lists_all_payments_in_id_order(
    client, session, seed_admin, seed_developer, auth_header
):
    p1, p2, _ = _seed_two_projects_with_payments(
        session, client, seed_admin, seed_developer, auth_header
    )
    admin_again = seed_admin(email="admin2@example.com")
    response = client.get("/payments", headers=auth_header(admin_again))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    assert [r["id"] for r in body] == sorted(r["id"] for r in body)


def test_admin_lists_payments_filtered_by_project(
    client, session, seed_admin, seed_developer, auth_header
):
    p1, p2, _ = _seed_two_projects_with_payments(
        session, client, seed_admin, seed_developer, auth_header
    )
    admin2 = seed_admin(email="admin2@example.com")
    response = client.get(
        f"/payments?project_id={p1.id}", headers=auth_header(admin2)
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert all(r["project_id"] == p1.id for r in body)


def test_admin_get_payment_detail_includes_breakdown(
    client, session, seed_admin, seed_developer, auth_header
):
    p1, _, payments = _seed_two_projects_with_payments(
        session, client, seed_admin, seed_developer, auth_header
    )
    admin2 = seed_admin(email="admin2@example.com")
    pid = payments[0]["id"]
    response = client.get(f"/payments/{pid}", headers=auth_header(admin2))
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == pid
    assert "developer_breakdown" in body
    assert len(body["developer_breakdown"]) == 2


def test_admin_get_payment_missing_id_returns_404(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.get("/payments/9999", headers=auth_header(admin))
    assert response.status_code == 404
    assert response.json()["detail"] == "payment not found"


def test_manager_can_read_payments(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    _, _, payments = _seed_two_projects_with_payments(
        session, client, seed_admin, seed_developer, auth_header
    )
    manager = seed_manager()
    h = auth_header(manager)
    assert client.get("/payments", headers=h).status_code == 200
    assert (
        client.get(f"/payments/{payments[0]['id']}", headers=h).status_code
        == 200
    )


def test_developer_cannot_list_payments(
    client, session, seed_admin, seed_developer, auth_header
):
    _, _, payments = _seed_two_projects_with_payments(
        session, client, seed_admin, seed_developer, auth_header
    )
    dev = seed_developer(name="C", email="c@example.com")
    h = auth_header(dev)
    assert client.get("/payments", headers=h).status_code == 403
    assert (
        client.get(f"/payments/{payments[0]['id']}", headers=h).status_code
        == 403
    )


def test_unauth_read_returns_401(
    client, session, seed_admin, seed_developer, auth_header
):
    _, _, payments = _seed_two_projects_with_payments(
        session, client, seed_admin, seed_developer, auth_header
    )
    assert client.get("/payments").status_code == 401
    assert client.get(f"/payments/{payments[0]['id']}").status_code == 401
