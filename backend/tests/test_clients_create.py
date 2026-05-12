"""US1: POST /clients — admin/manager create; developer denied; uniqueness; closed schema."""

from __future__ import annotations


_VALID_PAYLOAD = {
    "name": "Acme Corp",
    "email": "contact@acme.example.com",
    "phone": "+1-415-555-0101",
    "company_name": "Acme Holdings",
}


def test_admin_can_create_client(client, seed_admin, auth_header):
    admin = seed_admin()
    response = client.post(
        "/clients", json=_VALID_PAYLOAD, headers=auth_header(admin)
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] >= 1
    assert body["name"] == "Acme Corp"
    assert body["email"] == "contact@acme.example.com"
    assert body["phone"] == "+1-415-555-0101"
    assert body["company_name"] == "Acme Holdings"
    assert body["address"] is None
    assert body["notes"] is None
    assert body["is_active"] is True
    assert "created_at" in body and "updated_at" in body


def test_manager_can_create_client(client, seed_manager, auth_header):
    manager = seed_manager()
    response = client.post(
        "/clients", json=_VALID_PAYLOAD, headers=auth_header(manager)
    )
    assert response.status_code == 201
    assert response.json()["is_active"] is True


def test_developer_cannot_create_client(client, seed_developer, auth_header):
    developer = seed_developer()
    response = client.post(
        "/clients", json=_VALID_PAYLOAD, headers=auth_header(developer)
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}


def test_create_without_token_returns_401(client):
    response = client.post("/clients", json=_VALID_PAYLOAD)
    assert response.status_code == 401
    assert response.json() == {"detail": "Could not validate credentials"}


def test_duplicate_email_returns_409(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    first = client.post("/clients", json=_VALID_PAYLOAD, headers=headers)
    assert first.status_code == 201

    duplicate = {**_VALID_PAYLOAD, "phone": "+1-415-555-0200"}
    response = client.post("/clients", json=duplicate, headers=headers)
    assert response.status_code == 409
    assert response.json() == {
        "detail": "client with this email already exists"
    }


def test_duplicate_phone_returns_409(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    first = client.post("/clients", json=_VALID_PAYLOAD, headers=headers)
    assert first.status_code == 201

    duplicate = {**_VALID_PAYLOAD, "email": "other@example.com"}
    response = client.post("/clients", json=duplicate, headers=headers)
    assert response.status_code == 409
    assert response.json() == {
        "detail": "client with this phone already exists"
    }


def test_phone_without_plus_returns_422(client, seed_admin, auth_header):
    admin = seed_admin()
    payload = {**_VALID_PAYLOAD, "phone": "5555550100"}
    response = client.post(
        "/clients", json=payload, headers=auth_header(admin)
    )
    assert response.status_code == 422


def test_missing_required_field_returns_422(client, seed_admin, auth_header):
    admin = seed_admin()
    payload = {k: v for k, v in _VALID_PAYLOAD.items() if k != "name"}
    response = client.post(
        "/clients", json=payload, headers=auth_header(admin)
    )
    assert response.status_code == 422


def test_unknown_field_returns_422(client, seed_admin, auth_header):
    admin = seed_admin()
    payload = {**_VALID_PAYLOAD, "is_vip": True}
    response = client.post(
        "/clients", json=payload, headers=auth_header(admin)
    )
    assert response.status_code == 422


def test_email_lowercased_on_create(client, seed_admin, auth_header):
    admin = seed_admin()
    payload = {**_VALID_PAYLOAD, "email": "Contact@ACME.example.com"}
    response = client.post(
        "/clients", json=payload, headers=auth_header(admin)
    )
    assert response.status_code == 201
    assert response.json()["email"] == "contact@acme.example.com"
