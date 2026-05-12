"""US5: PATCH /modules/{id}/progress — assignee-only writes; auto-status; auto-complete.

Covers FR-019 ownership, FR-020 derived status, FR-021 progress only on active
projects, FR-014 active→completed auto-transition.
"""

from __future__ import annotations

from tests._projects_helpers import (
    seed_active_client,
    seed_active_project,
    seed_module,
    seed_pending_project,
)


def _activate(client, admin, auth_header, project_id):
    r = client.patch(
        f"/projects/{project_id}",
        json={"status": "active"},
        headers=auth_header(admin),
    )
    assert r.status_code == 200, r.text


def test_assigned_developer_can_update_progress(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 40},
        headers=auth_header(dev),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["progress"] == 40
    assert body["status"] == "in_progress"


def test_progress_zero_yields_pending_status(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    # First bump to 40 then back to 0.
    client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 40},
        headers=auth_header(dev),
    )
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 0},
        headers=auth_header(dev),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "pending"


def test_progress_100_completes_module_and_project(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 100},
        headers=auth_header(dev),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    # Project should have auto-completed.
    proj = client.get(f"/projects/{p.id}", headers=auth_header(admin))
    assert proj.json()["status"] == "completed"


def test_unassigned_developer_blocked_403(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev1 = seed_developer(email="d1@example.com")
    dev2 = seed_developer(email="d2@example.com")
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev1.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 50},
        headers=auth_header(dev2),
    )
    assert response.status_code == 403


def test_admin_can_update_progress(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 25},
        headers=auth_header(admin),
    )
    assert response.status_code == 200


def test_manager_can_update_progress(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    admin = seed_admin()
    manager = seed_manager()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 25},
        headers=auth_header(manager),
    )
    assert response.status_code == 200


def test_progress_on_pending_project_rejected(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 50},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_progress_out_of_range_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    r1 = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": -1},
        headers=auth_header(admin),
    )
    assert r1.status_code == 422
    r2 = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 101},
        headers=auth_header(admin),
    )
    assert r2.status_code == 422


def test_progress_unknown_field_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    response = client.patch(
        f"/modules/{m.id}/progress",
        json={"progress": 50, "status": "completed"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_progress_missing_module_returns_404(
    client, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.patch(
        "/modules/99999/progress",
        json={"progress": 10},
        headers=auth_header(admin),
    )
    assert response.status_code == 404


def test_partial_progress_does_not_autocomplete(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m1 = seed_module(
        session, project_id=p.id, developer_id=dev.id, share="40.00", name="m1"
    )
    seed_module(
        session, project_id=p.id, developer_id=dev.id, share="30.00", name="m2"
    )
    _activate(client, admin, auth_header, p.id)
    client.patch(
        f"/modules/{m1.id}/progress",
        json={"progress": 100},
        headers=auth_header(admin),
    )
    proj = client.get(f"/projects/{p.id}", headers=auth_header(admin))
    assert proj.json()["status"] == "active"
