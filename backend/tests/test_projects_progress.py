"""US6+US7: GET /projects/{id}/progress aggregation; DELETE /projects/{id} soft-delete.

Covers FR-022 mean-of-progress, FR-024 soft-delete + 404, FR-026 hidden 404 for
unassigned developers.
"""

from __future__ import annotations

from tests._projects_helpers import (
    seed_active_client,
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


def test_progress_zero_when_no_modules(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.get(
        f"/projects/{p.id}/progress", headers=auth_header(admin)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["project_id"] == p.id
    assert body["progress"] == 0.0
    assert body["modules"] == []


def test_progress_is_mean_of_module_progress(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m1 = seed_module(
        session, project_id=p.id, developer_id=dev.id, share="35.00", name="m1"
    )
    m2 = seed_module(
        session, project_id=p.id, developer_id=dev.id, share="35.00", name="m2"
    )
    _activate(client, admin, auth_header, p.id)
    client.patch(
        f"/modules/{m1.id}/progress",
        json={"progress": 40},
        headers=auth_header(admin),
    )
    client.patch(
        f"/modules/{m2.id}/progress",
        json={"progress": 80},
        headers=auth_header(admin),
    )
    response = client.get(
        f"/projects/{p.id}/progress", headers=auth_header(admin)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["progress"] == 60.0
    assert {m["name"] for m in body["modules"]} == {"m1", "m2"}


def test_progress_excludes_soft_deleted_modules(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m1 = seed_module(
        session, project_id=p.id, developer_id=dev.id, share="35.00", name="m1"
    )
    m2 = seed_module(
        session, project_id=p.id, developer_id=dev.id, share="35.00", name="m2"
    )
    _activate(client, admin, auth_header, p.id)
    client.patch(
        f"/modules/{m1.id}/progress",
        json={"progress": 50},
        headers=auth_header(admin),
    )
    # Soft-delete m2; its progress (0) should drop out of the mean.
    client.delete(f"/modules/{m2.id}", headers=auth_header(admin))
    response = client.get(
        f"/projects/{p.id}/progress", headers=auth_header(admin)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["progress"] == 50.0
    assert [m["id"] for m in body["modules"]] == [m1.id]


def test_developer_can_read_progress_when_assigned(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    seed_module(session, project_id=p.id, developer_id=dev.id, share="70.00")
    _activate(client, admin, auth_header, p.id)
    response = client.get(
        f"/projects/{p.id}/progress", headers=auth_header(dev)
    )
    assert response.status_code == 200


def test_developer_404_on_unassigned_progress(
    client, session, seed_developer, auth_header
):
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.get(
        f"/projects/{p.id}/progress", headers=auth_header(dev)
    )
    assert response.status_code == 404


def test_progress_missing_project_returns_404(
    client, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.get(
        "/projects/99999/progress", headers=auth_header(admin)
    )
    assert response.status_code == 404


# ---------- US7: soft-delete ----------


def test_admin_can_soft_delete_project(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    r = client.delete(f"/projects/{p.id}", headers=auth_header(admin))
    assert r.status_code == 204
    follow = client.get(f"/projects/{p.id}", headers=auth_header(admin))
    assert follow.status_code == 404


def test_manager_cannot_soft_delete_project(
    client, session, seed_manager, auth_header
):
    manager = seed_manager()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    r = client.delete(f"/projects/{p.id}", headers=auth_header(manager))
    assert r.status_code == 403


def test_developer_cannot_soft_delete_project(
    client, session, seed_developer, auth_header
):
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    r = client.delete(f"/projects/{p.id}", headers=auth_header(dev))
    assert r.status_code == 403


def test_soft_deleted_project_hidden_from_list(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = seed_active_client(session)
    p1 = seed_pending_project(session, client_id=c.id, name="Keep")
    p2 = seed_pending_project(session, client_id=c.id, name="Drop")
    client.delete(f"/projects/{p2.id}", headers=auth_header(admin))
    response = client.get("/projects", headers=auth_header(admin))
    assert response.status_code == 200
    names = [p["name"] for p in response.json()]
    assert "Keep" in names and "Drop" not in names
    assert p1.id in [p["id"] for p in response.json()]


def test_delete_missing_project_returns_404(
    client, seed_admin, auth_header
):
    admin = seed_admin()
    r = client.delete("/projects/99999", headers=auth_header(admin))
    assert r.status_code == 404
