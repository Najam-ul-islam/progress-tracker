"""US4: POST /projects/{id}/modules + PATCH/DELETE /modules/{id}.

Covers FR-009 developer eligibility, FR-010/011 share-cap dual gate,
FR-016 completed-project freeze, FR-018 closed schemas.
"""

from __future__ import annotations

from decimal import Decimal

from tests._projects_helpers import (
    seed_active_client,
    seed_active_project,
    seed_module,
    seed_pending_project,
)


def _module_payload(developer_id: int, **overrides) -> dict:
    base = {
        "name": "Module A",
        "assigned_developer_id": developer_id,
        "share_percentage": "30.00",
    }
    base.update(overrides)
    return base


def test_admin_can_create_module(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(dev.id),
        headers=auth_header(admin),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["project_id"] == p.id
    assert body["assigned_developer_id"] == dev.id
    assert body["share_percentage"] == "30.00"
    assert body["progress"] == 0
    assert body["status"] == "pending"


def test_manager_can_create_module(
    client, session, seed_manager, seed_developer, auth_header
):
    manager = seed_manager()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(dev.id),
        headers=auth_header(manager),
    )
    assert response.status_code == 201


def test_developer_cannot_create_module(
    client, session, seed_developer, auth_header
):
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(dev.id),
        headers=auth_header(dev),
    )
    assert response.status_code == 403


def test_assignee_must_have_developer_role(
    client, session, seed_admin, seed_manager, auth_header
):
    admin = seed_admin()
    manager = seed_manager()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(manager.id),
        headers=auth_header(admin),
    )
    assert response.status_code == 422
    assert "developer" in response.json()["detail"]


def test_assignee_must_exist(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(99999),
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_share_cap_blocks_overflow(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    seed_module(
        session, project_id=p.id, developer_id=dev.id, share="50.00"
    )
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(dev.id, name="Overflow", share_percentage="30.00"),
        headers=auth_header(admin),
    )
    assert response.status_code == 422
    assert "70.00" in response.json()["detail"]


def test_share_cap_at_exactly_70_succeeds(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    seed_module(
        session, project_id=p.id, developer_id=dev.id, share="40.00"
    )
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(dev.id, name="Caps it", share_percentage="30.00"),
        headers=auth_header(admin),
    )
    assert response.status_code == 201


def test_module_creation_on_completed_project_rejected(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_active_project(session, client_id=c.id)
    p.status = "completed"
    session.add(p)
    session.commit()
    response = client.post(
        f"/projects/{p.id}/modules",
        json=_module_payload(dev.id),
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_module_create_unknown_field_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    bad = _module_payload(dev.id, progress=10)
    response = client.post(
        f"/projects/{p.id}/modules", json=bad, headers=auth_header(admin)
    )
    assert response.status_code == 422


def test_module_create_on_missing_project_returns_404(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    response = client.post(
        "/projects/99999/modules",
        json=_module_payload(dev.id),
        headers=auth_header(admin),
    )
    assert response.status_code == 404


def test_admin_can_update_module(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.patch(
        f"/modules/{m.id}",
        json={"name": "Renamed"},
        headers=auth_header(admin),
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_developer_cannot_update_module(
    client, session, seed_developer, auth_header
):
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.patch(
        f"/modules/{m.id}",
        json={"name": "X"},
        headers=auth_header(dev),
    )
    assert response.status_code == 403


def test_module_share_change_respects_cap(
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
        session, project_id=p.id, developer_id=dev.id, share="20.00", name="m2"
    )
    # m1 already 40, others sum to 20. Bumping m1 to 60 → 60+20=80 > 70.
    response = client.patch(
        f"/modules/{m1.id}",
        json={"share_percentage": "60.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_module_share_change_at_cap_allowed(
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
        session, project_id=p.id, developer_id=dev.id, share="20.00", name="m2"
    )
    # Bump m1 to 50 → 50+20=70 OK.
    response = client.patch(
        f"/modules/{m1.id}",
        json={"share_percentage": "50.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 200
    assert Decimal(response.json()["share_percentage"]) == Decimal("50.00")


def test_module_update_empty_body_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.patch(
        f"/modules/{m.id}", json={}, headers=auth_header(admin)
    )
    assert response.status_code == 422


def test_module_update_unknown_field_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.patch(
        f"/modules/{m.id}",
        json={"progress": 10},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_module_update_missing_returns_404(
    client, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.patch(
        "/modules/99999",
        json={"name": "x"},
        headers=auth_header(admin),
    )
    assert response.status_code == 404


def test_admin_can_delete_module(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.delete(f"/modules/{m.id}", headers=auth_header(admin))
    assert response.status_code == 204
    # Subsequent fetch hidden by soft-delete (FR-026).
    follow = client.patch(
        f"/modules/{m.id}",
        json={"name": "x"},
        headers=auth_header(admin),
    )
    assert follow.status_code == 404


def test_manager_cannot_delete_module(
    client, session, seed_manager, seed_developer, auth_header
):
    manager = seed_manager()
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.delete(f"/modules/{m.id}", headers=auth_header(manager))
    assert response.status_code == 403


def test_developer_cannot_delete_module(
    client, session, seed_developer, auth_header
):
    dev = seed_developer()
    c = seed_active_client(session)
    p = seed_pending_project(session, client_id=c.id)
    m = seed_module(session, project_id=p.id, developer_id=dev.id, share="30.00")
    response = client.delete(f"/modules/{m.id}", headers=auth_header(dev))
    assert response.status_code == 403
