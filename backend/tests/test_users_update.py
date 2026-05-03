"""US3 — PATCH /users/{id}.

Admin only. Accepts {name, role, is_active} subsets. Empty body and forbidden
fields (email, password) → 422. Non-existent id → 404.
"""

from __future__ import annotations

import pytest


def test_admin_patches_name(client, seed_admin, seed_developer, auth_header):
    admin = seed_admin()
    dev = seed_developer()
    original_updated = dev.updated_at

    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(admin),
        json={"name": "New Name"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "New Name"
    assert "password_hash" not in response.text


def test_admin_patches_role(client, seed_admin, seed_developer, auth_header):
    admin = seed_admin()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(admin),
        json={"role": "manager"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "manager"


def test_admin_patch_invalid_role_returns_422(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(admin),
        json={"role": "superuser"},
    )
    assert response.status_code == 422


def test_manager_patch_forbidden(
    client, seed_admin, seed_manager, seed_developer, auth_header
):
    seed_admin()
    manager = seed_manager()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(manager),
        json={"name": "x"},
    )
    assert response.status_code == 403


def test_developer_patch_self_forbidden(
    client, seed_admin, seed_developer, auth_header
):
    seed_admin()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(dev),
        json={"name": "x"},
    )
    assert response.status_code == 403


def test_admin_empty_body_returns_422(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}", headers=auth_header(admin), json={}
    )
    assert response.status_code == 422


def test_admin_all_null_body_returns_422(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(admin),
        json={"name": None, "role": None, "is_active": None},
    )
    assert response.status_code == 422


def test_admin_missing_id_returns_404(client, seed_admin, auth_header):
    admin = seed_admin()
    response = client.patch(
        "/users/99999", headers=auth_header(admin), json={"name": "x"}
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "User not found"}


def test_admin_email_field_returns_422(
    client, seed_admin, seed_developer, auth_header
):
    """FR-012: email is forbidden via extra='forbid'."""
    admin = seed_admin()
    dev = seed_developer()
    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(admin),
        json={"email": "new@example.com"},
    )
    assert response.status_code == 422


def test_admin_password_field_returns_422(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(admin),
        json={"password": "letmein99"},
    )
    assert response.status_code == 422


def test_patch_no_token_returns_401(client):
    response = client.patch("/users/1", json={"name": "x"})
    assert response.status_code == 401


def test_admin_patch_bumps_updated_at(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    before = dev.updated_at.isoformat() if dev.updated_at else None

    response = client.patch(
        f"/users/{dev.id}",
        headers=auth_header(admin),
        json={"name": "Bumped"},
    )
    assert response.status_code == 200
    after = response.json()["updated_at"]
    assert after >= before  # FR-010
