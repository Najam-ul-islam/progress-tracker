"""US3 — GET /auth/me acceptance tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import get_settings


def _login(client, email: str, password: str) -> str:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_me_returns_current_user(client, seed_user):
    seed_user(email="me@example.com", password="correct-horse", role="admin")
    token = _login(client, "me@example.com", "correct-horse")
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "me@example.com"
    assert body["role"] == "admin"
    assert "password_hash" not in body


def test_me_without_header_returns_401(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Could not validate credentials"}


def test_me_bad_signature_returns_401(client, seed_user):
    seed_user(email="me@example.com", password="correct-horse")
    forged = jwt.encode(
        {
            "sub": "1",
            "email": "me@example.com",
            "role": "developer",
            "iat": 0,
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        },
        "WRONG-SECRET",
        algorithm="HS256",
    )
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert resp.status_code == 401


def test_me_expired_token_returns_401(client, seed_user):
    seed_user(email="me@example.com", password="correct-horse")
    settings = get_settings()
    expired = jwt.encode(
        {
            "sub": "1",
            "email": "me@example.com",
            "role": "developer",
            "iat": 0,
            "exp": int((datetime.now(timezone.utc) - timedelta(seconds=10)).timestamp()),
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


def test_me_deleted_user_returns_401(client, session, seed_user):
    """FR-021: token bound to a deleted user → 401."""
    user = seed_user(email="ghost@example.com", password="correct-horse")
    token = _login(client, "ghost@example.com", "correct-horse")
    session.delete(user)
    session.commit()
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
