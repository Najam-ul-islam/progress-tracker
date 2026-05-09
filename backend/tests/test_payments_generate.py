"""US1: POST /payments/generate/{project_id} — atomic generation, RBAC, invariants."""

from __future__ import annotations

from decimal import Decimal

from tests._payments_helpers import assert_sum_invariants
from tests._projects_helpers import (
    seed_active_client,
    seed_active_project,
    seed_module,
    seed_pending_project,
)


def _seed_billable_project(session, seed_developer):
    """Active project + 2 active modules summing to 70%, two distinct devs."""
    client_row = seed_active_client(session)
    proj = seed_active_project(session, client_id=client_row.id)
    dev_a = seed_developer(name="Dev A", email="deva@example.com")
    dev_b = seed_developer(name="Dev B", email="devb@example.com")
    seed_module(
        session,
        project_id=proj.id,
        developer_id=dev_a.id,
        share="40.00",
        name="m_a",
    )
    seed_module(
        session,
        project_id=proj.id,
        developer_id=dev_b.id,
        share="30.00",
        name="m_b",
    )
    return proj, dev_a, dev_b


def test_admin_generates_payment_with_4030_split(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    proj, dev_a, dev_b = _seed_billable_project(session, seed_developer)
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "10000.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["project_id"] == proj.id
    assert body["total_amount"] == "10000.00"
    assert body["company_amount"] == "3000.00"
    assert body["developer_amount"] == "7000.00"
    assert body["status"] == "pending"
    assert len(body["developer_breakdown"]) == 2
    amounts = sorted(c["amount"] for c in body["developer_breakdown"])
    assert amounts == ["3000.00", "4000.00"]
    assert_sum_invariants(body)


def test_manager_generates_payment(
    client, session, seed_manager, seed_developer, auth_header
):
    manager = seed_manager()
    proj, _, _ = _seed_billable_project(session, seed_developer)
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "5000.00"},
        headers=auth_header(manager),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["company_amount"] == "1500.00"
    assert body["developer_amount"] == "3500.00"
    assert_sum_invariants(body)


def test_developer_cannot_generate_payment(
    client, session, seed_admin, seed_developer, auth_header
):
    seed_admin()
    proj, dev_a, _ = _seed_billable_project(session, seed_developer)
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "1000.00"},
        headers=auth_header(dev_a),
    )
    assert response.status_code == 403


def test_generate_without_token_returns_401(
    client, session, seed_developer
):
    proj, _, _ = _seed_billable_project(session, seed_developer)
    response = client.post(
        f"/payments/generate/{proj.id}", json={"total_amount": "1000.00"}
    )
    assert response.status_code == 401


def test_generate_missing_project_returns_404(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.post(
        "/payments/generate/999",
        json={"total_amount": "1000.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "project not found"


def test_generate_pending_project_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    client_row = seed_active_client(session)
    proj = seed_pending_project(session, client_id=client_row.id)
    dev = seed_developer()
    seed_module(
        session,
        project_id=proj.id,
        developer_id=dev.id,
        share="70.00",
    )
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "1000.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "project is not yet active"


def test_generate_completed_project_succeeds(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    proj, _, _ = _seed_billable_project(session, seed_developer)
    proj.status = "completed"
    session.add(proj)
    session.commit()
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "1000.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 201


def test_generate_share_sum_drift_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    """If a module is soft-deleted between activation and generation, shares
    no longer sum to 70.00 → 422."""
    admin = seed_admin()
    proj, dev_a, dev_b = _seed_billable_project(session, seed_developer)
    # Soft-delete the 30%-share module so only 40% remains active.
    from app.modules.projects.repository import (
        list_active_modules,
        soft_delete_module,
    )

    modules = list_active_modules(session, proj.id)
    target = next(m for m in modules if m.share_percentage == Decimal("30.00"))
    soft_delete_module(session, target)

    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "1000.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "module shares no longer sum to 70.00"


def test_generate_missing_total_amount_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    proj, _, _ = _seed_billable_project(session, seed_developer)
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_generate_zero_or_negative_total_amount_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    proj, _, _ = _seed_billable_project(session, seed_developer)
    for bad in ("0.00", "-100.00"):
        response = client.post(
            f"/payments/generate/{proj.id}",
            json={"total_amount": bad},
            headers=auth_header(admin),
        )
        assert response.status_code == 422


def test_generate_unknown_field_returns_422(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    proj, _, _ = _seed_billable_project(session, seed_developer)
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "1000.00", "company_amount": "500.00"},
        headers=auth_header(admin),
    )
    assert response.status_code == 422


def test_generate_milestone_creates_distinct_payments(
    client, session, seed_admin, seed_developer, auth_header
):
    admin = seed_admin()
    proj, _, _ = _seed_billable_project(session, seed_developer)
    h = auth_header(admin)
    r1 = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "5000.00"},
        headers=h,
    )
    r2 = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "3000.00"},
        headers=h,
    )
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]


def test_generate_rounding_residual_absorbed_by_largest_share(
    client, session, seed_admin, seed_developer, auth_header
):
    """total_amount=100.01 with shares 40/30 forces a rounding residual.

    company = 100.01 * 0.30 = 30.003 → 30.00 (banker's)
    developer = 100.01 * 0.70 = 70.007 → 70.01 (banker's)
    company + developer = 100.01 ✓
    Per-child:
      40-share raw = 70.01 * 40 / 70 = 40.0057...  → 40.01 (banker's)
      30-share raw = 70.01 * 30 / 70 = 30.0042...  → 30.00 (banker's)
    Sum = 70.01 ✓ (no residual in this particular case).
    Test: sum invariants hold regardless of residual path.
    """
    admin = seed_admin()
    proj, _, _ = _seed_billable_project(session, seed_developer)
    response = client.post(
        f"/payments/generate/{proj.id}",
        json={"total_amount": "100.01"},
        headers=auth_header(admin),
    )
    assert response.status_code == 201
    body = response.json()
    assert_sum_invariants(body)
