"""US3: PATCH /projects/{id} — rename, dates, total_amount, activation gate."""

from __future__ import annotations

from tests._projects_helpers import (
    seed_active_client,
    seed_module,
    seed_pending_project,
)


def test_admin_can_rename(client, session, seed_admin, auth_header):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.patch(
        f"/projects/{p.id}",
        json={"name": "Renamed"},
        headers=auth_header(admin),
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_manager_can_update(client, session, seed_manager, auth_header):
    m = seed_manager()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.patch(
        f"/projects/{p.id}",
        json={"description": "x"},
        headers=auth_header(m),
    )
    assert response.status_code == 200


def test_developer_cannot_update(client, session, seed_developer, auth_header):
    d = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.patch(
        f"/projects/{p.id}",
        json={"name": "x"},
        headers=auth_header(d),
    )
    assert response.status_code == 403


def test_empty_body_returns_422(client, session, seed_admin, auth_header):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.patch(
        f"/projects/{p.id}", json={}, headers=auth_header(admin)
    )
    assert response.status_code == 422


def test_missing_project_returns_404(client, seed_admin, auth_header):
    admin = seed_admin()
    response = client.patch(
        "/projects/9999", json={"name": "x"}, headers=auth_header(admin)
    )
    assert response.status_code == 404


def test_bad_date_range_after_merge_returns_422(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    # Original 2026-06-01..2026-08-31; pushing end_date earlier than start
    response = client.patch(
        f"/projects/{p.id}",
        json={"end_date": "2026-05-01"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_completed_status_from_client_rejected(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.patch(
        f"/projects/{p.id}",
        json={"status": "completed"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_pending_status_rejected(client, session, seed_admin, auth_header):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.patch(
        f"/projects/{p.id}",
        json={"status": "pending"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_activation_under_allocated_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    seed_module(
        session, project_id=p.id, developer_id=dev.id, share="60.00"
    )
    response = client.patch(
        f"/projects/{p.id}",
        json={"status": "active"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422
    assert "60.00" in response.json()["detail"]


def test_activation_at_70_succeeds(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    seed_module(
        session, project_id=p.id, developer_id=dev.id, share="70.00"
    )
    response = client.patch(
        f"/projects/{p.id}",
        json={"status": "active"},
        headers=auth_header(admin),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "active"


def test_activation_then_back_to_active_rejected(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    seed_module(
        session, project_id=p.id, developer_id=dev.id, share="70.00"
    )
    h = auth_header(admin)
    r1 = client.patch(
        f"/projects/{p.id}", json={"status": "active"}, headers=h
    )
    assert r1.status_code == 200
    r2 = client.patch(
        f"/projects/{p.id}", json={"status": "active"}, headers=h
    )
    assert r2.status_code == 422


def test_unknown_field_returns_422(client, session, seed_admin, auth_header):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.patch(
        f"/projects/{p.id}",
        json={"company_share": "40.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422
