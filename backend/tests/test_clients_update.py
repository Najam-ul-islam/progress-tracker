"""US3: PATCH /clients/{id} — admin/manager update; cross-row uniqueness; closed schema."""

from __future__ import annotations


def _create_client(
    client, headers, *, name="Acme Corp", email="contact@acme.example.com",
    phone="+1-415-555-0101",
):
    response = client.post(
        "/clients",
        json={"name": name, "email": email, "phone": phone},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_admin_can_rename_client(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    response = client.patch(
        f"/clients/{seeded['id']}",
        json={"name": "Acme Holdings"},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Acme Holdings"
    assert body["updated_at"] >= seeded["created_at"]


def test_manager_can_update_notes(client, seed_admin, seed_manager, auth_header):
    admin = seed_admin()
    seeded = _create_client(client, auth_header(admin))

    manager = seed_manager()
    response = client.patch(
        f"/clients/{seeded['id']}",
        json={"notes": "Owes us a kickoff doc"},
        headers=auth_header(manager),
    )
    assert response.status_code == 200
    assert response.json()["notes"] == "Owes us a kickoff doc"


def test_empty_patch_returns_422(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    response = client.patch(
        f"/clients/{seeded['id']}", json={}, headers=headers
    )
    assert response.status_code == 422


def test_all_null_patch_returns_422(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    response = client.patch(
        f"/clients/{seeded['id']}",
        json={
            "name": None,
            "email": None,
            "phone": None,
            "company_name": None,
            "address": None,
            "notes": None,
        },
        headers=headers,
    )
    assert response.status_code == 422


def test_extra_field_returns_422(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    response = client.patch(
        f"/clients/{seeded['id']}",
        json={"name": "X", "is_vip": True},
        headers=headers,
    )
    assert response.status_code == 422


def test_bad_phone_returns_422(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    response = client.patch(
        f"/clients/{seeded['id']}",
        json={"phone": "5555550100"},
        headers=headers,
    )
    assert response.status_code == 422


def test_patch_missing_id_returns_404(client, seed_admin, auth_header):
    admin = seed_admin()
    response = client.patch(
        "/clients/99999",
        json={"name": "Whatever"},
        headers=auth_header(admin),
    )
    assert response.status_code == 404


def test_developer_cannot_patch(client, seed_admin, seed_developer, auth_header):
    admin = seed_admin()
    seeded = _create_client(client, auth_header(admin))

    developer = seed_developer()
    response = client.patch(
        f"/clients/{seeded['id']}",
        json={"name": "hax"},
        headers=auth_header(developer),
    )
    assert response.status_code == 403


def test_cross_row_email_collision_returns_409(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    a = _create_client(client, headers)
    b = _create_client(
        client,
        headers,
        name="Beta LLC",
        email="hello@beta.example.com",
        phone="+44 20 7946 0000",
    )

    response = client.patch(
        f"/clients/{a['id']}",
        json={"email": b["email"]},
        headers=headers,
    )
    assert response.status_code == 409
    assert response.json() == {
        "detail": "client with this email already exists"
    }


def test_cross_row_phone_collision_returns_409(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    a = _create_client(client, headers)
    b = _create_client(
        client,
        headers,
        name="Beta LLC",
        email="hello@beta.example.com",
        phone="+44 20 7946 0000",
    )

    response = client.patch(
        f"/clients/{a['id']}",
        json={"phone": b["phone"]},
        headers=headers,
    )
    assert response.status_code == 409
    assert response.json() == {
        "detail": "client with this phone already exists"
    }


def test_patching_email_to_own_value_succeeds(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)
    seeded = _create_client(client, headers)

    response = client.patch(
        f"/clients/{seeded['id']}",
        json={"email": seeded["email"]},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["email"] == seeded["email"]
