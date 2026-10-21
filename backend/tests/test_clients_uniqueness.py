"""Cross-cutting Edge Cases for clients uniqueness (T024).

Covers:
- (a) Re-use of email/phone after soft delete: POST → DELETE → POST same email/phone → 201.
- (b) Cross-row PATCH collision: PATCH A's email to B's email → 409 + A unchanged.
- (c) Email casing normalisation: POST `Foo@Bar.com`, then POST `foo@bar.com` → 409.
"""

from __future__ import annotations


_PAYLOAD = {
    "name": "Acme Corp",
    "email": "contact@acme.example.com",
    "phone": "+1-415-555-0101",
}


def test_email_can_be_reused_after_soft_delete(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)

    first = client.post("/clients", json=_PAYLOAD, headers=headers)
    assert first.status_code == 201
    deleted_id = first.json()["id"]

    delete_response = client.delete(f"/clients/{deleted_id}", headers=headers)
    assert delete_response.status_code == 204

    # Same email + phone should now be acceptable on a fresh row.
    second = client.post(
        "/clients",
        json={**_PAYLOAD, "name": "Acme Renewed"},
        headers=headers,
    )
    assert second.status_code == 201
    assert second.json()["id"] != deleted_id


def test_cross_row_patch_collision_leaves_target_unchanged(
    client, seed_admin, auth_header
):
    admin = seed_admin()
    headers = auth_header(admin)
    a = client.post("/clients", json=_PAYLOAD, headers=headers).json()
    b = client.post(
        "/clients",
        json={
            "name": "Beta LLC",
            "email": "hello@beta.example.com",
            "phone": "+44 20 7946 0000",
        },
        headers=headers,
    ).json()

    response = client.patch(
        f"/clients/{a['id']}",
        json={"email": b["email"]},
        headers=headers,
    )
    assert response.status_code == 409

    # Re-fetch A and confirm it is unchanged.
    refetch = client.get(f"/clients/{a['id']}", headers=headers).json()
    assert refetch["email"] == a["email"]


def test_email_casing_is_normalised_on_create(client, seed_admin, auth_header):
    admin = seed_admin()
    headers = auth_header(admin)

    first = client.post(
        "/clients",
        json={**_PAYLOAD, "email": "Contact@ACME.example.com"},
        headers=headers,
    )
    assert first.status_code == 201
    assert first.json()["email"] == "contact@acme.example.com"

    # A second POST with the lowercased version should collide.
    second = client.post(
        "/clients",
        json={**_PAYLOAD, "phone": "+1-415-555-0200"},
        headers=headers,
    )
    assert second.status_code == 409
    assert second.json() == {
        "detail": "client with this email already exists"
    }
