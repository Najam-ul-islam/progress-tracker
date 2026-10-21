"""US1 — POST /auth/register acceptance tests."""

from __future__ import annotations


def test_register_returns_201_and_sanitised_user(client):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Alice Admin",
            "email": "Alice@Example.com",
            "password": "correct-horse",
            "role": "admin",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "Alice Admin"
    assert body["email"] == "alice@example.com"  # FR-004 lowercased
    assert body["role"] == "admin"
    assert "id" in body
    # FR-019 / SC-002: hash never appears in the response.
    assert "password_hash" not in body
    assert "password" not in body


def test_register_persists_bcrypt_hash_not_plaintext(client, session):
    from app.modules.users.repository import get_user_by_email

    plaintext = "correct-horse"
    resp = client.post(
        "/auth/register",
        json={
            "name": "Bob",
            "email": "bob@example.com",
            "password": plaintext,
            "role": "developer",
        },
    )
    assert resp.status_code == 201, resp.text

    stored = get_user_by_email(session, "bob@example.com")
    assert stored is not None
    assert stored.password_hash != plaintext
    assert stored.password_hash.startswith("$2b$")  # FR-002 / SC-002


def test_register_duplicate_email_returns_409(client):
    payload = {
        "name": "Charlie",
        "email": "dup@example.com",
        "password": "correct-horse",
        "role": "manager",
    }
    first = client.post("/auth/register", json=payload)
    assert first.status_code == 201
    second = client.post("/auth/register", json=payload)
    assert second.status_code == 409
    assert "detail" in second.json()


def test_register_invalid_role_returns_422(client):
    resp = client.post(
        "/auth/register",
        json={
            "name": "Dave",
            "email": "dave@example.com",
            "password": "correct-horse",
            "role": "wizard",
        },
    )
    assert resp.status_code == 422


def test_register_missing_fields_returns_422(client):
    resp = client.post(
        "/auth/register",
        json={"email": "eve@example.com"},
    )
    assert resp.status_code == 422
