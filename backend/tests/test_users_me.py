"""US1 — GET /users/me

Every authenticated role reads their own profile. No password_hash leaks. 401
on missing header. 401 when token references a deleted user (FR-021).
"""

from __future__ import annotations

import pytest


@pytest.mark.parametrize(
    "role_fixture",
    ["seed_admin", "seed_manager", "seed_developer"],
)
def test_users_me_returns_self_for_every_role(
    request, client, role_fixture, auth_header
):
    seed = request.getfixturevalue(role_fixture)
    user = seed()

    response = client.get("/users/me", headers=auth_header(user))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user.id
    assert body["email"] == user.email
    assert body["role"] == user.role
    assert body["is_active"] is True
    assert "password_hash" not in body


def test_users_me_no_token_returns_401(client):
    response = client.get("/users/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Could not validate credentials"}


def test_users_me_token_for_deleted_user_returns_401(
    client, session, seed_developer, auth_header
):
    user = seed_developer()
    headers = auth_header(user)
    session.delete(user)
    session.commit()

    response = client.get("/users/me", headers=headers)

    assert response.status_code == 401
    assert response.json() == {"detail": "Could not validate credentials"}


def test_users_me_excludes_password_hash(client, seed_admin, auth_header):
    user = seed_admin()
    response = client.get("/users/me", headers=auth_header(user))
    assert response.status_code == 200
    assert "password_hash" not in response.text
