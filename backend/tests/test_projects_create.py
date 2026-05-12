"""US1: POST /projects — admin/manager create; developer denied; FK and validation."""

from __future__ import annotations

import pytest

from app.modules.clients.repository import create_client


def _seed_active_client(session, *, email: str = "acme@example.com") -> int:
    c = create_client(
        session,
        name="Acme",
        email=email,
        phone="+1-415-555-0101",
    )
    assert c.id is not None
    return c.id


def _payload(client_id: int, **overrides) -> dict:
    base = {
        "name": "Migration Sprint",
        "client_id": client_id,
        "total_amount": "10000.00",
        "start_date": "2026-06-01",
        "end_date": "2026-08-31",
    }
    base.update(overrides)
    return base


def test_admin_can_create_project(client, session, seed_admin, auth_header):
    admin = seed_admin()
    cid = _seed_active_client(session)
    response = client.post(
        "/projects", json=_payload(cid), headers=auth_header(admin)
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"] >= 1
    assert body["name"] == "Migration Sprint"
    assert body["client_id"] == cid
    assert body["total_amount"] == "10000.00"
    assert body["company_share"] == "30.00"
    assert body["developer_share"] == "70.00"
    assert body["status"] == "pending"
    assert body["is_active"] is True


def test_manager_can_create_project(client, session, seed_manager, auth_header):
    manager = seed_manager()
    cid = _seed_active_client(session)
    response = client.post(
        "/projects", json=_payload(cid), headers=auth_header(manager)
    )
    assert response.status_code == 201


def test_developer_cannot_create_project(
    client, session, seed_developer, auth_header
):
    dev = seed_developer()
    cid = _seed_active_client(session)
    response = client.post(
        "/projects", json=_payload(cid), headers=auth_header(dev)
    )
    assert response.status_code == 403


def test_create_without_token_returns_401(client, session):
    cid = _seed_active_client(session)
    response = client.post("/projects", json=_payload(cid))
    assert response.status_code == 401


def test_missing_required_field_returns_422(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    cid = _seed_active_client(session)
    bad = _payload(cid)
    del bad["name"]
    response = client.post("/projects", json=bad, headers=auth_header(admin))
    assert response.status_code == 422


def test_unknown_field_returns_422(client, session, seed_admin, auth_header):
    admin = seed_admin()
    cid = _seed_active_client(session)
    bad = _payload(cid, status="active")
    response = client.post("/projects", json=bad, headers=auth_header(admin))
    assert response.status_code == 422


def test_nonexistent_client_id_returns_422(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    _seed_active_client(session)
    response = client.post(
        "/projects",
        json=_payload(999_999),
        headers=auth_header(admin),
    )
    assert response.status_code == 422
    assert "client_id" in response.json()["detail"]


def test_bad_date_range_returns_422(client, session, seed_admin, auth_header):
    admin = seed_admin()
    cid = _seed_active_client(session)
    response = client.post(
        "/projects",
        json=_payload(cid, start_date="2026-08-31", end_date="2026-06-01"),
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_negative_total_amount_returns_422(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    cid = _seed_active_client(session)
    response = client.post(
        "/projects",
        json=_payload(cid, total_amount="-1.00"),
        headers=auth_header(admin),
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "field",
    ["company_share", "developer_share", "id", "is_active"],
)
def test_server_set_fields_rejected(
    client, session, seed_admin, auth_header, field
):
    admin = seed_admin()
    cid = _seed_active_client(session)
    bad = _payload(cid)
    bad[field] = "30.00" if field.endswith("share") else 1
    response = client.post("/projects", json=bad, headers=auth_header(admin))
    assert response.status_code == 422
