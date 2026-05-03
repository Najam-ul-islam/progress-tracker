"""US2 — GET /users and GET /users/{id}.

Admin/manager may list and read any user. Developer may read only themselves;
any other id returns 403 (not 404 — id-probing protection per
contracts/access-control-matrix.md). Missing id returns 404 for admin/manager,
403 for developer.
"""

from __future__ import annotations

import pytest


@pytest.fixture(name="seed_three")
def seed_three_fixture(seed_admin, seed_manager, seed_developer):
    admin = seed_admin()
    manager = seed_manager()
    developer = seed_developer()
    return admin, manager, developer


def test_list_users_admin_returns_all(client, seed_three, auth_header):
    admin, _, _ = seed_three
    response = client.get("/users", headers=auth_header(admin))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 3
    assert "password_hash" not in response.text


def test_list_users_manager_returns_all(client, seed_three, auth_header):
    _, manager, _ = seed_three
    response = client.get("/users", headers=auth_header(manager))
    assert response.status_code == 200
    assert len(response.json()) == 3


def test_list_users_developer_forbidden(client, seed_three, auth_header):
    _, _, developer = seed_three
    response = client.get("/users", headers=auth_header(developer))
    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}


def test_get_user_by_id_admin_reads_any(client, seed_three, auth_header):
    admin, _, developer = seed_three
    response = client.get(f"/users/{developer.id}", headers=auth_header(admin))
    assert response.status_code == 200
    assert response.json()["id"] == developer.id
    assert "password_hash" not in response.text


def test_get_user_by_id_manager_reads_any(client, seed_three, auth_header):
    _, manager, developer = seed_three
    response = client.get(f"/users/{developer.id}", headers=auth_header(manager))
    assert response.status_code == 200


def test_get_user_by_id_admin_missing_returns_404(
    client, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.get("/users/99999", headers=auth_header(admin))
    assert response.status_code == 404
    assert response.json() == {"detail": "User not found"}


def test_get_user_by_id_developer_self_ok(client, seed_three, auth_header):
    _, _, developer = seed_three
    response = client.get(
        f"/users/{developer.id}", headers=auth_header(developer)
    )
    assert response.status_code == 200
    assert response.json()["id"] == developer.id


def test_get_user_by_id_developer_other_forbidden(
    client, seed_three, auth_header
):
    admin, _, developer = seed_three
    response = client.get(f"/users/{admin.id}", headers=auth_header(developer))
    assert response.status_code == 403
    assert response.json() == {"detail": "Forbidden"}


def test_get_user_by_id_developer_missing_id_forbidden(
    client, seed_developer, auth_header
):
    """Developer probing a non-existent id must get 403 not 404 — otherwise the
    differential leaks which ids exist (access-control-matrix §"Ordering")."""
    developer = seed_developer()
    response = client.get("/users/99999", headers=auth_header(developer))
    assert response.status_code == 403


def test_list_users_no_token_returns_401(client):
    response = client.get("/users")
    assert response.status_code == 401


def test_get_user_by_id_no_token_returns_401(client):
    response = client.get("/users/1")
    assert response.status_code == 401
