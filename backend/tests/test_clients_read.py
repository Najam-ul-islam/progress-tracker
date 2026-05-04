"""US2: GET /clients and GET /clients/{id} — admin/manager read; developer denied; 404 on miss."""

from __future__ import annotations


def _seed_two_clients(client, headers) -> tuple[int, int]:
    a = client.post(
        "/clients",
        json={
            "name": "Acme Corp",
            "email": "contact@acme.example.com",
            "phone": "+1-415-555-0101",
        },
        headers=headers,
    )
    b = client.post(
        "/clients",
        json={
            "name": "Beta LLC",
            "email": "hello@beta.example.com",
            "phone": "+44 20 7946 0000",
        },
        headers=headers,
    )
    assert a.status_code == 201 and b.status_code == 201
    return a.json()["id"], b.json()["id"]


def test_admin_can_list_clients(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    _seed_two_clients(client, headers)

    response = client.get("/clients", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2
    assert {row["email"] for row in body} == {
        "contact@acme.example.com",
        "hello@beta.example.com",
    }


def test_manager_can_list_clients(client, seed_admin, seed_manager, auth_header):
    admin = seed_admin()
    _seed_two_clients(client, auth_header(admin))

    manager = seed_manager()
    response = client.get("/clients", headers=auth_header(manager))
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_developer_cannot_list_clients(client, seed_admin, seed_developer, auth_header):
    admin = seed_admin()
    _seed_two_clients(client, auth_header(admin))

    developer = seed_developer()
    response = client.get("/clients", headers=auth_header(developer))
    assert response.status_code == 403


def test_admin_can_get_client_by_id(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    acme_id, _ = _seed_two_clients(client, headers)

    response = client.get(f"/clients/{acme_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == acme_id
    assert response.json()["name"] == "Acme Corp"


def test_manager_can_get_client_by_id(client, seed_admin, seed_manager, auth_header):
    admin = seed_admin()
    acme_id, _ = _seed_two_clients(client, auth_header(admin))

    manager = seed_manager()
    response = client.get(f"/clients/{acme_id}", headers=auth_header(manager))
    assert response.status_code == 200


def test_get_missing_id_returns_404(client, seed_admin, auth_header):
    admin = seed_admin()
    response = client.get("/clients/99999", headers=auth_header(admin))
    assert response.status_code == 404
    assert response.json() == {"detail": "Client not found"}


def test_developer_cannot_get_client_by_id(client, seed_admin, seed_developer, auth_header):
    admin = seed_admin()
    acme_id, _ = _seed_two_clients(client, auth_header(admin))

    developer = seed_developer()
    response = client.get(f"/clients/{acme_id}", headers=auth_header(developer))
    assert response.status_code == 403


def test_list_without_token_returns_401(client):
    response = client.get("/clients")
    assert response.status_code == 401


def test_get_by_id_without_token_returns_401(client):
    response = client.get("/clients/1")
    assert response.status_code == 401
