"""US4 — role-guard dependency acceptance tests."""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.db.session import get_session
from app.modules.auth.dependencies import (
    require_admin,
    require_any,
    require_developer,
)
from app.modules.users.model import User


def _build_guard_app(session) -> TestClient:
    """Mount a temp router inside a fresh FastAPI app, override get_session
    onto the same in-memory engine, and return a TestClient.
    """
    app = FastAPI()

    @app.get("/admin-only")
    def admin_only(user: User = Depends(require_admin)) -> dict:
        return {"id": user.id, "role": user.role}

    @app.get("/dev-only")
    def dev_only(user: User = Depends(require_developer)) -> dict:
        return {"id": user.id, "role": user.role}

    @app.get("/admin-or-manager")
    def admin_or_manager(
        user: User = Depends(require_any("admin", "manager")),
    ) -> dict:
        return {"id": user.id, "role": user.role}

    def _override_get_session():
        yield session

    app.dependency_overrides[get_session] = _override_get_session
    return TestClient(app)


def _login(client, email: str, password: str) -> str:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_require_admin_admits_admin_rejects_developer(client, session, seed_user):
    seed_user(email="a@x.com", password="pw1234567", role="admin")
    seed_user(email="d@x.com", password="pw1234567", role="developer")
    admin_token = _login(client, "a@x.com", "pw1234567")
    dev_token = _login(client, "d@x.com", "pw1234567")

    guard_client = _build_guard_app(session)

    ok = guard_client.get("/admin-only", headers={"Authorization": f"Bearer {admin_token}"})
    assert ok.status_code == 200
    assert ok.json()["role"] == "admin"

    forbidden = guard_client.get(
        "/admin-only", headers={"Authorization": f"Bearer {dev_token}"}
    )
    assert forbidden.status_code == 403
    assert forbidden.json() == {"detail": "Forbidden"}


def test_require_any_admits_either_role(client, session, seed_user):
    seed_user(email="m@x.com", password="pw1234567", role="manager")
    seed_user(email="a2@x.com", password="pw1234567", role="admin")
    seed_user(email="d2@x.com", password="pw1234567", role="developer")
    manager_token = _login(client, "m@x.com", "pw1234567")
    admin_token = _login(client, "a2@x.com", "pw1234567")
    dev_token = _login(client, "d2@x.com", "pw1234567")

    guard_client = _build_guard_app(session)

    assert guard_client.get(
        "/admin-or-manager", headers={"Authorization": f"Bearer {manager_token}"}
    ).status_code == 200
    assert guard_client.get(
        "/admin-or-manager", headers={"Authorization": f"Bearer {admin_token}"}
    ).status_code == 200
    forbidden = guard_client.get(
        "/admin-or-manager", headers={"Authorization": f"Bearer {dev_token}"}
    )
    assert forbidden.status_code == 403
    assert forbidden.json() == {"detail": "Forbidden"}
