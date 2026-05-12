"""US2: GET /reports/projects — per-project rows with filters."""

from __future__ import annotations

from decimal import Decimal

from app.modules.projects.repository import soft_delete_project

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


def test_admin_unfiltered_lists_all_active_projects(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get("/reports/projects", headers=landscape["auth_header"])
    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 4
    for row in rows:
        assert {
            "id",
            "name",
            "client_id",
            "client_name",
            "status",
            "start_date",
            "end_date",
            "overall_progress",
            "module_count",
            "modules_completed",
            "modules_in_progress",
            "modules_pending",
            "invoiced_amount",
            "outstanding_amount",
            "modules",
        } == set(row.keys())

    by_name = {r["name"]: r for r in rows}
    active = by_name["P-Active"]
    assert active["module_count"] == 2
    # share-weighted progress = (100 * 40 + 60 * 30) / 70 = 5800/70 ≈ 82.857 → 83
    assert active["overall_progress"] == 83
    assert Decimal(active["invoiced_amount"]) == Decimal("3000.00")


def test_manager_can_read_projects_report(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/projects", headers=auth_header(landscape["manager"])
    )
    assert response.status_code == 200
    assert len(response.json()) == 4


def test_filter_by_project_status(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/projects?project_status=active",
        headers=landscape["auth_header"],
    )
    assert response.status_code == 200
    rows = response.json()
    # 2 active projects (P-Active and P-Overdue both have status='active').
    assert len(rows) == 2
    for r in rows:
        assert r["status"] == "active"


def test_filter_by_client_id(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    c1 = landscape["clients"][0]
    response = client.get(
        f"/reports/projects?client_id={c1.id}", headers=landscape["auth_header"]
    )
    assert response.status_code == 200
    rows = response.json()
    assert all(r["client_id"] == c1.id for r in rows)
    assert len(rows) == 2


def test_unknown_client_id_returns_422(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/projects?client_id=9999", headers=landscape["auth_header"]
    )
    assert response.status_code == 422
    assert "9999" in response.json()["detail"]


def test_bad_date_range_returns_422(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/projects?date_from=2026-06-01&date_to=2026-05-01",
        headers=landscape["auth_header"],
    )
    assert response.status_code == 422


def test_unknown_status_returns_422(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/projects?project_status=archived",
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
    response = client.get("/reports/projects", headers=auth_header(dev))
    assert response.status_code == 403


def test_unauth_returns_401(client):
    response = client.get("/reports/projects")
    assert response.status_code == 401


def test_soft_deleted_project_excluded(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    soft_delete_project(session, landscape["projects"]["pending"])
    response = client.get(
        "/reports/projects", headers=landscape["auth_header"]
    )
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 3
    assert all(r["name"] != "P-Pending" for r in rows)
