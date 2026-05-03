"""SC-006 sweep — `password_hash` must not appear in any 2xx body from the
users module. Walks every users endpoint with admin credentials."""

from __future__ import annotations


def test_no_password_hash_in_any_users_response(
    client, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    dev = seed_developer()
    headers = auth_header(admin)

    responses = [
        client.get("/users/me", headers=headers),
        client.get("/users", headers=headers),
        client.get("/users/developers", headers=headers),
        client.get(f"/users/{dev.id}", headers=headers),
        client.patch(
            f"/users/{dev.id}", headers=headers, json={"name": "Renamed"}
        ),
        client.patch(
            f"/users/{dev.id}/status",
            headers=headers,
            json={"is_active": False},
        ),
    ]

    for response in responses:
        assert response.status_code < 400, f"unexpected: {response.status_code} for {response.url}"
        assert "password_hash" not in response.text, (
            f"password_hash leaked in response from {response.url}"
        )
