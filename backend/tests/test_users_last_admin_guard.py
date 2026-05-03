"""FR-014 — last-admin invariant.

Both PATCH /users/{id} (role demote) and PATCH /users/{id}/status (deactivate)
must refuse with 409 when the change would leave zero active admins. With ≥2
admins the same write succeeds.
"""

from __future__ import annotations


def test_last_admin_demote_returns_409(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    seed_developer()

    response = client.patch(
        f"/users/{admin.id}",
        headers=auth_header(admin),
        json={"role": "manager"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "cannot demote the last remaining admin"

    # Row unchanged.
    session.refresh(admin)
    assert admin.role == "admin"


def test_last_admin_deactivate_returns_409(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    seed_developer()

    response = client.patch(
        f"/users/{admin.id}/status",
        headers=auth_header(admin),
        json={"is_active": False},
    )
    assert response.status_code == 409

    session.refresh(admin)
    assert admin.is_active is True


def test_two_admins_demote_succeeds(
    client, seed_admin, seed_user, auth_header
):
    admin1 = seed_admin(email="admin1@example.com")
    admin2 = seed_user(role="admin", email="admin2@example.com")

    response = client.patch(
        f"/users/{admin2.id}",
        headers=auth_header(admin1),
        json={"role": "manager"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "manager"


def test_two_admins_deactivate_other_succeeds(
    client, seed_admin, seed_user, auth_header
):
    admin1 = seed_admin(email="admin1@example.com")
    admin2 = seed_user(role="admin", email="admin2@example.com")

    response = client.patch(
        f"/users/{admin2.id}/status",
        headers=auth_header(admin1),
        json={"is_active": False},
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False
