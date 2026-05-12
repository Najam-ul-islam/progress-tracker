"""US2: GET /projects + GET /projects/{id} — admin/manager see all; developer
sees only assigned; per-id 404 hides existence (FR-008, FR-026)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.modules.clients.repository import create_client
from app.modules.projects.repository import create_module, create_project


def _seed(session) -> dict:
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    return {"client_id": c.id}


def _seed_project(session, client_id: int, **overrides):
    fields = dict(
        name="P1",
        description=None,
        client_id=client_id,
        total_amount=Decimal("1000.00"),
        company_share=Decimal("30.00"),
        developer_share=Decimal("70.00"),
        start_date=date(2026, 6, 1),
        end_date=date(2026, 8, 31),
        status="pending",
        is_active=True,
    )
    fields.update(overrides)
    return create_project(session, **fields)


def test_admin_lists_all_projects(client, session, seed_admin, auth_header):
    seeds = _seed(session)
    p1 = _seed_project(session, seeds["client_id"], name="P1")
    p2 = _seed_project(session, seeds["client_id"], name="P2")
    admin = seed_admin()
    response = client.get("/projects", headers=auth_header(admin))
    assert response.status_code == 200
    ids = [p["id"] for p in response.json()]
    assert p1.id in ids and p2.id in ids


def test_manager_lists_all_projects(client, session, seed_manager, auth_header):
    seeds = _seed(session)
    _seed_project(session, seeds["client_id"])
    manager = seed_manager()
    response = client.get("/projects", headers=auth_header(manager))
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_developer_only_sees_assigned_projects(
    client, session, seed_developer, auth_header
):
    dev1 = seed_developer(email="dev1@example.com")
    dev2 = seed_developer(email="dev2@example.com")
    seeds = _seed(session)
    p1 = _seed_project(session, seeds["client_id"], name="Assigned")
    _seed_project(session, seeds["client_id"], name="Unassigned")
    create_module(
        session,
        project_id=p1.id,
        name="m",
        description=None,
        assigned_developer_id=dev1.id,
        progress=0,
        status="pending",
        share_percentage=Decimal("30.00"),
        is_active=True,
    )
    r1 = client.get("/projects", headers=auth_header(dev1))
    assert r1.status_code == 200
    assert [p["name"] for p in r1.json()] == ["Assigned"]
    r2 = client.get("/projects", headers=auth_header(dev2))
    assert r2.status_code == 200
    assert r2.json() == []


def test_developer_404s_on_unassigned_project(
    client, session, seed_developer, auth_header
):
    dev = seed_developer()
    seeds = _seed(session)
    p = _seed_project(session, seeds["client_id"])
    response = client.get(f"/projects/{p.id}", headers=auth_header(dev))
    assert response.status_code == 404


def test_admin_404_on_missing_id(client, seed_admin, auth_header):
    admin = seed_admin()
    response = client.get("/projects/99999", headers=auth_header(admin))
    assert response.status_code == 404


def test_get_without_token_returns_401(client, session):
    seeds = _seed(session)
    p = _seed_project(session, seeds["client_id"])
    response = client.get(f"/projects/{p.id}")
    assert response.status_code == 401


def test_admin_can_get_by_id(client, session, seed_admin, auth_header):
    admin = seed_admin()
    seeds = _seed(session)
    p = _seed_project(session, seeds["client_id"])
    response = client.get(f"/projects/{p.id}", headers=auth_header(admin))
    assert response.status_code == 200
    assert response.json()["id"] == p.id
