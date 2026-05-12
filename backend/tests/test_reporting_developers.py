"""US3: GET /reports/developers — per-developer rows with earnings."""

from __future__ import annotations

from decimal import Decimal

from tests._reporting_helpers import seed_reporting_landscape


def _seed(client, session, seed_admin, seed_manager, seed_developer, auth_header):
    return seed_reporting_landscape(
        client=client,
        session=session,
        seed_admin=seed_admin,
        seed_manager=seed_manager,
        seed_developer=seed_developer,
        auth_header=auth_header,
    )


def test_admin_unfiltered_lists_all_developers(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/developers", headers=landscape["auth_header"]
    )
    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 3
    for row in rows:
        assert {
            "id",
            "name",
            "email",
            "module_count",
            "modules_completed",
            "modules_in_progress",
            "modules_pending",
            "earnings",
            "earnings_by_project",
        } == set(row.keys())


def test_manager_can_read(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/developers", headers=auth_header(landscape["manager"])
    )
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_filter_by_developer_id(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    d1 = landscape["developers"][0]
    response = client.get(
        f"/reports/developers?developer_id={d1.id}",
        headers=landscape["auth_header"],
    )
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["id"] == d1.id


def test_unknown_developer_id_returns_422(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/developers?developer_id=9999",
        headers=landscape["auth_header"],
    )
    assert response.status_code == 422


def test_developer_denied(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    dev = landscape["developers"][0]
    response = client.get("/reports/developers", headers=auth_header(dev))
    assert response.status_code == 403


def test_unauth_returns_401(client):
    response = client.get("/reports/developers")
    assert response.status_code == 401


def test_earnings_split_paid_plus_pending_equals_total(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/developers", headers=landscape["auth_header"]
    )
    rows = response.json()
    for row in rows:
        e = row["earnings"]
        assert (
            Decimal(e["paid"]) + Decimal(e["pending"])
            == Decimal(e["total"])
        )
        for proj in row["earnings_by_project"]:
            assert (
                Decimal(proj["paid"]) + Decimal(proj["pending"])
                == Decimal(proj["total"])
            )
