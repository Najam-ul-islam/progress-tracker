"""US5 — GET /users/developers.

Returns active developers only. Admin/manager 200; developer 403; empty roster
returns [] (not 404).
"""

from __future__ import annotations


def test_developers_admin_returns_only_active_developers(
    client, seed_admin, seed_manager, seed_developer, seed_user, auth_header
):
    admin = seed_admin()
    seed_manager()
    active_dev_1 = seed_developer(email="dev1@example.com")
    active_dev_2 = seed_user(role="developer", email="dev2@example.com")
    inactive_dev = seed_user(role="developer", email="dev3@example.com")

    # Deactivate one developer through the admin API to reuse production code paths.
    client.patch(
        f"/users/{inactive_dev.id}/status",
        headers=auth_header(admin),
        json={"is_active": False},
    )

    response = client.get("/users/developers", headers=auth_header(admin))
    assert response.status_code == 200
    body = response.json()
    ids = {u["id"] for u in body}
    assert ids == {active_dev_1.id, active_dev_2.id}
    assert all(u["role"] == "developer" for u in body)
    assert all(u["is_active"] is True for u in body)
    assert "password_hash" not in response.text


def test_developers_manager_allowed(
    client, seed_admin, seed_manager, seed_developer, auth_header
):
    seed_admin()
    manager = seed_manager()
    seed_developer()

    response = client.get("/users/developers", headers=auth_header(manager))
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_developers_developer_forbidden(
    client, seed_admin, seed_developer, auth_header
):
    seed_admin()
    dev = seed_developer()

    response = client.get("/users/developers", headers=auth_header(dev))
    assert response.status_code == 403


def test_developers_empty_returns_200_empty_list(
    client, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.get("/users/developers", headers=auth_header(admin))
    assert response.status_code == 200
    assert response.json() == []


def test_developers_no_token_returns_401(client):
    response = client.get("/users/developers")
    assert response.status_code == 401
