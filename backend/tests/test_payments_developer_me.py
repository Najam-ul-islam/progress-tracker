"""US3: GET /payments/developer/me — developer self-service; admin/manager denied."""

from __future__ import annotations

from tests._payments_helpers import seed_payment_for_project
from tests._projects_helpers import (
    seed_active_client,
    seed_active_project,
    seed_module,
)


def _seed_two_devs_with_payment(
    session, client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    client_row = seed_active_client(session)
    proj = seed_active_project(session, client_id=client_row.id)
    dev_a = seed_developer(name="A", email="a@example.com")
    dev_b = seed_developer(name="B", email="b@example.com")
    seed_module(
        session, project_id=proj.id, developer_id=dev_a.id, share="40.00", name="m1"
    )
    seed_module(
        session, project_id=proj.id, developer_id=dev_b.id, share="30.00", name="m2"
    )
    seed_payment_for_project(
        client,
        project_id=proj.id,
        total_amount="1000.00",
        auth_header=auth_header(admin),
    )
    return proj, dev_a, dev_b


def test_developer_a_sees_only_own_row(
    client, session, seed_admin, seed_developer, auth_header
):
    _, dev_a, _ = _seed_two_devs_with_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    response = client.get(
        "/payments/developer/me", headers=auth_header(dev_a)
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["developer_id"] == dev_a.id
    assert body[0]["amount"] == "400.00"
    assert "project_id" in body[0]


def test_developer_b_sees_only_own_row(
    client, session, seed_admin, seed_developer, auth_header
):
    _, _, dev_b = _seed_two_devs_with_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    response = client.get(
        "/payments/developer/me", headers=auth_header(dev_b)
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["developer_id"] == dev_b.id
    assert body[0]["amount"] == "300.00"


def test_developer_with_no_assignments_returns_empty(
    client, session, seed_admin, seed_developer, auth_header
):
    _seed_two_devs_with_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    dev_c = seed_developer(name="C", email="c@example.com")
    response = client.get(
        "/payments/developer/me", headers=auth_header(dev_c)
    )
    assert response.status_code == 200
    assert response.json() == []


def test_admin_cannot_use_developer_me_endpoint(
    client, session, seed_admin, seed_developer, auth_header
):
    _seed_two_devs_with_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    admin2 = seed_admin(email="admin2@example.com")
    response = client.get(
        "/payments/developer/me", headers=auth_header(admin2)
    )
    assert response.status_code == 403


def test_manager_cannot_use_developer_me_endpoint(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    _seed_two_devs_with_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    manager = seed_manager()
    response = client.get(
        "/payments/developer/me", headers=auth_header(manager)
    )
    assert response.status_code == 403


def test_developer_me_unauth_returns_401(client):
    response = client.get("/payments/developer/me")
    assert response.status_code == 401


def test_soft_deleted_project_does_not_hide_developer_rows(
    client, session, seed_admin, seed_developer, auth_header
):
    proj, dev_a, _ = _seed_two_devs_with_payment(
        session, client, seed_admin, seed_developer, auth_header
    )
    proj.is_active = False
    session.add(proj)
    session.commit()
    response = client.get(
        "/payments/developer/me", headers=auth_header(dev_a)
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
