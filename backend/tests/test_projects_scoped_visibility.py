"""FR-029..FR-036: Scoped financial visibility — developer vs admin views.

Verifies that:
- Developers see ONLY their own modules with computed financial fields.
- Developers NEVER see total_amount, company_share, developer_share, client_id.
- Admin/manager paths are unchanged.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.modules.clients.repository import create_client
from app.modules.projects.repository import (
    create_module,
    create_project,
)


def _seed_project_with_modules(session, client_id: int):
    p = create_project(
        session,
        name="P1",
        description=None,
        client_id=client_id,
        total_amount=Decimal("10000.00"),
        company_share=Decimal("30.00"),
        developer_share=Decimal("70.00"),
        start_date=date(2026, 6, 1),
        end_date=date(2026, 8, 31),
        status="active",
        is_active=True,
    )
    m1 = create_module(
        session,
        project_id=p.id,
        name="m1",
        description=None,
        assigned_developer_id=1,
        progress=50,
        status="in_progress",
        share_percentage=Decimal("35.00"),
        is_active=True,
    )
    m2 = create_module(
        session,
        project_id=p.id,
        name="m2",
        description=None,
        assigned_developer_id=2,
        progress=100,
        status="completed",
        share_percentage=Decimal("35.00"),
        is_active=True,
    )
    return p, m1, m2


def test_developer_project_list_hides_financials(
    client, session, seed_developer, auth_header
):
    dev1 = seed_developer(email="dev1@example.com")
    dev2 = seed_developer(email="dev2@example.com")
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    _seed_project_with_modules(session, c.id)

    r1 = client.get("/projects", headers=auth_header(dev1))
    assert r1.status_code == 200
    body1 = r1.json()
    assert len(body1) == 1
    p1 = body1[0]
    assert p1["id"] is not None
    assert "total_amount" not in p1
    assert "company_share" not in p1
    assert "developer_share" not in p1
    assert "client_id" not in p1
    assert p1["modules"] == [
        {
            "id": 1,
            "name": "m1",
            "progress": 50,
            "status": "in_progress",
            "module_allocation": "3500.00",
            "earned_amount": "1750.00",
        }
    ]

    r2 = client.get("/projects", headers=auth_header(dev2))
    assert r2.status_code == 200
    body2 = r2.json()
    assert len(body2) == 1
    p2 = body2[0]
    assert p2["modules"] == [
        {
            "id": 2,
            "name": "m2",
            "progress": 100,
            "status": "completed",
            "module_allocation": "3500.00",
            "earned_amount": "3500.00",
        }
    ]


def test_developer_project_detail_hides_financials(
    client, session, seed_developer, auth_header
):
    dev1 = seed_developer(email="dev1@example.com")
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    p, _, _ = _seed_project_with_modules(session, c.id)

    r = client.get(f"/projects/{p.id}", headers=auth_header(dev1))
    assert r.status_code == 200
    body = r.json()
    assert "total_amount" not in body
    assert "company_share" not in body
    assert "developer_share" not in body
    assert "client_id" not in body
    assert body["modules"] == [
        {
            "id": 1,
            "name": "m1",
            "progress": 50,
            "status": "in_progress",
            "module_allocation": "3500.00",
            "earned_amount": "1750.00",
        }
    ]


def test_developer_progress_shares_weighted_and_scoped(
    client, session, seed_developer, auth_header
):
    """FR-022: progress computed over all modules; modules array scoped to caller."""
    dev1 = seed_developer(email="dev1@example.com")
    dev2 = seed_developer(email="dev2@example.com")
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    _seed_project_with_modules(session, c.id)

    # m1 = 35% at 50, m2 = 35% at 100. Weighted = (50*35 + 100*35) / 70 = 75.0
    r = client.get("/projects/1/progress", headers=auth_header(dev1))
    assert r.status_code == 200
    body = r.json()
    assert body["progress"] == 75.0
    assert [m["id"] for m in body["modules"]] == [1]
    mod = body["modules"][0]
    assert mod["module_allocation"] == "3500.00"
    assert mod["earned_amount"] == "1750.00"


def test_developer_progress_hides_other_developer_modules(
    client, session, seed_developer, auth_header
):
    """A developer reading progress on an assigned project must not see other devs' modules."""
    dev1 = seed_developer(email="dev1@example.com")
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    p, m1, m2 = _seed_project_with_modules(session, c.id)

    r = client.get(f"/projects/{p.id}/progress", headers=auth_header(dev1))
    assert r.status_code == 200
    body = r.json()
    assert [m["id"] for m in body["modules"]] == [m1.id]
    assert [m["name"] for m in body["modules"]] == ["m1"]
    assert "share_percentage" not in body["modules"][0]
    assert "assigned_developer_id" not in body["modules"][0]


def test_developer_empty_list_when_no_assignments(
    client, session, seed_developer, auth_header
):
    dev = seed_developer(email="lonely@example.com")
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    create_project(
        session,
        name="P1",
        description=None,
        client_id=c.id,
        total_amount=Decimal("1000.00"),
        company_share=Decimal("30.00"),
        developer_share=Decimal("70.00"),
        start_date=date(2026, 6, 1),
        end_date=date(2026, 8, 31),
        status="active",
        is_active=True,
    )
    r = client.get("/projects", headers=auth_header(dev))
    assert r.status_code == 200
    assert r.json() == []


def test_admin_still_sees_full_project_read(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    p, _, _ = _seed_project_with_modules(session, c.id)

    r = client.get(f"/projects/{p.id}", headers=auth_header(admin))
    assert r.status_code == 200
    body = r.json()
    assert body["total_amount"] == "10000.00"
    assert body["company_share"] == "30.00"
    assert body["developer_share"] == "70.00"
    assert body["client_id"] == c.id


def test_admin_progress_shows_all_modules(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    c = create_client(
        session, name="Acme", email="a@e.com", phone="+1-415-555-0101"
    )
    p, m1, m2 = _seed_project_with_modules(session, c.id)

    r = client.get(f"/projects/{p.id}/progress", headers=auth_header(admin))
    assert r.status_code == 200
    body = r.json()
    assert body["progress"] == 75.0
    module_ids = [m["id"] for m in body["modules"]]
    assert m1.id in module_ids
    assert m2.id in module_ids
    # Admin view retains original schema fields, not the developer-computed ones
    assert "share_percentage" in body["modules"][0]
    assert "assigned_developer_id" in body["modules"][0]
    assert "module_allocation" not in body["modules"][0]
    assert "earned_amount" not in body["modules"][0]
