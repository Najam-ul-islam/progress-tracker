"""US5: GET /reports/developers/me — developer self-service report."""

from __future__ import annotations

from decimal import Decimal

from tests._reporting_helpers import (
    assert_no_developer_data_leaked,
    seed_reporting_landscape,
)


def _seed(client, session, seed_admin, seed_manager, seed_developer, auth_header):
    return seed_reporting_landscape(
        client=client,
        session=session,
        seed_admin=seed_admin,
        seed_manager=seed_manager,
        seed_developer=seed_developer,
        auth_header=auth_header,
    )


def test_developer_a_sees_own_data_only(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    d1 = landscape["developers"][0]
    response = client.get(
        "/reports/developers/me", headers=auth_header(d1)
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == d1.id
    assert_no_developer_data_leaked(body, allowed_developer_id=d1.id)
    # d1 has 2 modules: auth-flow (active, completed) + billing (completed).
    assert body["module_count"] == 2
    assert body["modules_completed"] == 2


def test_developer_b_sees_disjoint_data(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    d2 = landscape["developers"][1]
    response = client.get(
        "/reports/developers/me", headers=auth_header(d2)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == d2.id
    # d2 has 2 modules: dashboards (active, in_progress) + exports (completed, in_progress 50%).
    assert body["module_count"] == 2


def test_admin_denied(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/developers/me", headers=landscape["auth_header"]
    )
    assert response.status_code == 403


def test_manager_denied(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/developers/me", headers=auth_header(landscape["manager"])
    )
    assert response.status_code == 403


def test_unauth_returns_401(client):
    response = client.get("/reports/developers/me")
    assert response.status_code == 401


def test_developer_with_no_assignments(
    client, session, seed_admin, seed_developer, auth_header
):
    # No landscape; just one developer, no modules, no payments.
    dev = seed_developer(name="Lonely", email="lonely@example.com")
    response = client.get(
        "/reports/developers/me", headers=auth_header(dev)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == dev.id
    assert body["module_count"] == 0
    assert body["modules_completed"] == 0
    assert body["modules_in_progress"] == 0
    assert body["modules_pending"] == 0
    assert body["modules"] == []
    assert Decimal(body["earnings"]["paid"]) == Decimal("0.00")
    assert Decimal(body["earnings"]["pending"]) == Decimal("0.00")
    assert Decimal(body["earnings"]["total"]) == Decimal("0.00")
