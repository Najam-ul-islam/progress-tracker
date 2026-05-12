"""US4: DELETE /clients/{id} — admin only; soft delete; idempotent re-delete returns 404."""

from __future__ import annotations


def _create_client(client, headers):
    response = client.post(
        "/clients",
        json={
            "name": "Acme Corp",
            "email": "contact@acme.example.com",
            "phone": "+1-415-555-0101",
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_admin_can_soft_delete_client(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    response = client.delete(f"/clients/{seeded['id']}", headers=headers)
    assert response.status_code == 204
    assert response.text == ""


def test_manager_cannot_delete(client, seed_admin, seed_manager, auth_header):
    admin = seed_admin()
    seeded = _create_client(client, auth_header(admin))

    manager = seed_manager()
    response = client.delete(
        f"/clients/{seeded['id']}", headers=auth_header(manager)
    )
    assert response.status_code == 403


def test_developer_cannot_delete(client, seed_admin, seed_developer, auth_header):
    admin = seed_admin()
    seeded = _create_client(client, auth_header(admin))

    developer = seed_developer()
    response = client.delete(
        f"/clients/{seeded['id']}", headers=auth_header(developer)
    )
    assert response.status_code == 403


def test_get_after_delete_returns_404(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    delete_response = client.delete(f"/clients/{seeded['id']}", headers=headers)
    assert delete_response.status_code == 204

    get_response = client.get(f"/clients/{seeded['id']}", headers=headers)
    assert get_response.status_code == 404


def test_list_after_delete_excludes_row(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    client.delete(f"/clients/{seeded['id']}", headers=headers)

    list_response = client.get("/clients", headers=headers)
    assert list_response.status_code == 200
    assert all(row["id"] != seeded["id"] for row in list_response.json())


def test_redelete_returns_404(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    first = client.delete(f"/clients/{seeded['id']}", headers=headers)
    assert first.status_code == 204
    second = client.delete(f"/clients/{seeded['id']}", headers=headers)
    assert second.status_code == 404


def test_delete_without_token_returns_401(client):
    response = client.delete("/clients/1")
    assert response.status_code == 401
