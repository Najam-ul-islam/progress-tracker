"""US4 — PATCH /users/{id}/status + FR-013 login bridge.

Admin-only flag flip. Deactivated user cannot log in (byte-identical 401).
Manager/developer 403. Self-deactivate-as-last-admin → 409.
"""

from __future__ import annotations


def test_admin_deactivates_developer_then_login_blocked(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(password="correct-horse")

    # Capture the wrong-password 401 body BEFORE deactivation for byte-identity comparison.
    wrong_pw_response = client.post(
        "/auth/login",
        json={"email": dev.email, "password": "WRONG-PASSWORD"},
    )
    assert wrong_pw_response.status_code == 401
    canonical_401_body = wrong_pw_response.json()

    # Deactivate.
    response = client.patch(
        f"/users/{dev.id}/status",
        headers=auth_header(admin),
        json={"is_active": False},
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert "password_hash" not in response.text

    # FR-013: deactivated user cannot log in. SC-005: byte-identical body.
    deactivated_response = client.post(
        "/auth/login",
        json={"email": dev.email, "password": "correct-horse"},
    )
    assert deactivated_response.status_code == 401
    assert deactivated_response.json() == canonical_401_body


def test_admin_reactivates_developer(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer(password="correct-horse")

    client.patch(
        f"/users/{dev.id}/status",
        headers=auth_header(admin),
        json={"is_active": False},
    )

    response = client.patch(
        f"/users/{dev.id}/status",
        headers=auth_header(admin),
        json={"is_active": True},
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is True

    # And login works again.
    login_response = client.post(
        "/auth/login",
        json={"email": dev.email, "password": "correct-horse"},
    )
    assert login_response.status_code == 200


def test_manager_status_forbidden(
    client, seed_admin, seed_manager, seed_developer, auth_header
):
    seed_admin()
    manager = seed_manager()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}/status",
        headers=auth_header(manager),
        json={"is_active": False},
    )
    assert response.status_code == 403


def test_developer_status_forbidden(
    client, seed_admin, seed_developer, auth_header
):
    seed_admin()
    dev = seed_developer()

    response = client.patch(
        f"/users/{dev.id}/status",
        headers=auth_header(dev),
        json={"is_active": False},
    )
    assert response.status_code == 403


def test_admin_self_deactivate_as_last_admin_returns_409(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    seed_developer()

    response = client.patch(
        f"/users/{admin.id}/status",
        headers=auth_header(admin),
        json={"is_active": False},
    )
    assert response.status_code == 409
    assert "deactivate" in response.json()["detail"]


def test_admin_status_missing_id_returns_404(client, seed_admin, auth_header):
    admin = seed_admin()
    response = client.patch(
        "/users/99999",
        headers=auth_header(admin),
        json={"is_active": False},
    )
    assert response.status_code == 404


def test_status_no_token_returns_401(client):
    response = client.patch("/users/1/status", json={"is_active": False})
    assert response.status_code == 401


def test_status_extra_fields_returns_422(
    client, seed_admin, seed_developer, auth_header
):
    """FR-012: only `is_active` is allowed on UserStatusUpdate."""
    admin = seed_admin()
    dev = seed_developer()
    response = client.patch(
        f"/users/{dev.id}/status",
        headers=auth_header(admin),
        json={"is_active": False, "role": "manager"},
    )
    assert response.status_code == 422
