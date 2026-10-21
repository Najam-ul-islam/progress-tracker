"""SC-003: every protected endpoint rejects requests with no Authorization
header. As more modules add `Depends(get_current_user)` / `require_*`, they
become covered automatically because this test enumerates app.routes."""

from __future__ import annotations

from app.modules.auth.dependencies import (
    get_current_user,
    require_admin,
    require_any,
    require_developer,
    require_manager,
)
from app.modules.auth.routes import router as auth_router

PROTECTED_DEPENDENCIES = {
    get_current_user,
    require_admin,
    require_manager,
    require_developer,
}


def _route_uses_protected_dep(route) -> bool:
    deps = getattr(route, "dependant", None)
    if deps is None:
        return False
    pending = [deps]
    while pending:
        node = pending.pop()
        if getattr(node, "call", None) in PROTECTED_DEPENDENCIES:
            return True
        pending.extend(getattr(node, "dependencies", []))
    return False


def test_every_protected_route_rejects_no_auth_header(client):
    from app.main import app as fastapi_app

    sweep_count = 0
    for route in fastapi_app.routes:
        if not hasattr(route, "dependant"):
            continue
        if not _route_uses_protected_dep(route):
            continue
        for method in (route.methods or set()) - {"HEAD", "OPTIONS"}:
            sweep_count += 1
            resp = client.request(method, route.path)
            assert resp.status_code == 401, (
                f"{method} {route.path} returned {resp.status_code}, expected 401"
            )
    # Sanity: at least /auth/me must be in the sweep today.
    assert sweep_count >= 1
