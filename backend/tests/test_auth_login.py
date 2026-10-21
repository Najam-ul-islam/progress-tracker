"""US2 — POST /auth/login acceptance tests."""

from __future__ import annotations

import time

from jose import jwt

from app.core.config import get_settings


def test_login_returns_token_and_user_envelope(client, seed_user):
    seed_user(email="m@n.com", password="correct-horse", role="manager")
    resp = client.post(
        "/auth/login",
        json={"email": "m@n.com", "password": "correct-horse"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == "m@n.com"
    assert body["user"]["role"] == "manager"
    assert "password_hash" not in body["user"]

    # Decode token and assert claims (FR-008).
    settings = get_settings()
    payload = jwt.decode(
        body["access_token"],
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    assert payload["email"] == "m@n.com"
    assert payload["role"] == "manager"
    assert int(payload["sub"]) == body["user"]["id"]
    assert "iat" in payload and "exp" in payload


def test_login_exp_within_configured_window(client, seed_user):
    seed_user(email="w@n.com", password="correct-horse", role="developer")
    before = int(time.time())
    resp = client.post(
        "/auth/login",
        json={"email": "w@n.com", "password": "correct-horse"},
    )
    after = int(time.time())
    assert resp.status_code == 200

    settings = get_settings()
    payload = jwt.decode(
        resp.json()["access_token"],
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    expected = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    delta = payload["exp"] - before
    # FR-009 / acceptance scenario 4: matches the configured window within ±5 s.
    assert abs(delta - expected) <= 5 + (after - before)


def test_login_wrong_password_returns_401(client, seed_user):
    seed_user(email="x@n.com", password="correct-horse")
    resp = client.post(
        "/auth/login",
        json={"email": "x@n.com", "password": "wrong"},
    )
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Could not validate credentials"}


def test_login_unknown_email_returns_identical_401(client, seed_user):
    """SC-005: byte-identical body for unknown-email vs wrong-password."""
    seed_user(email="x@n.com", password="correct-horse")
    wrong_password = client.post(
        "/auth/login",
        json={"email": "x@n.com", "password": "wrong"},
    )
    unknown_email = client.post(
        "/auth/login",
        json={"email": "ghost@example.com", "password": "anything"},
    )
    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    assert wrong_password.content == unknown_email.content
