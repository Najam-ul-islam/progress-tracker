"""US1: GET /reports/dashboard — composite operations summary.

RBAC: admin and manager allowed; developer denied. The dashboard never
accepts query parameters and always returns a structurally valid payload
even on an empty system.
"""

from __future__ import annotations

from decimal import Decimal

from app.modules.projects.repository import soft_delete_project

from tests._reporting_helpers import (
    assert_dashboard_payload_shape,
    seed_reporting_landscape,
)


def test_admin_dashboard_against_seeded_landscape(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = seed_reporting_landscape(
        client=client,
        session=session,
        seed_admin=seed_admin,
        seed_manager=seed_manager,
        seed_developer=seed_developer,
        auth_header=auth_header,
    )
    response = client.get(
        "/reports/dashboard", headers=landscape["auth_header"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert_dashboard_payload_shape(body)

    assert body["projects"]["total"] == 4
    assert body["projects"]["pending"] == 1
    assert body["projects"]["active"] == 2
    assert body["projects"]["completed"] == 1
    assert body["projects"]["overdue"] == 1

    assert body["developers"]["total"] == 3
    assert body["developers"]["with_active_assignments"] == 3

    payments = body["payments"]
    assert Decimal(payments["total_revenue"]) == Decimal("6000.00")
    assert Decimal(payments["total_company_reserve"]) == Decimal("1800.00")
    assert Decimal(payments["total_developer_disbursed"]) == Decimal("4200.00")
    assert Decimal(payments["pending_amount"]) == Decimal("5000.00")


def test_manager_sees_same_dashboard(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = seed_reporting_landscape(
        client=client,
        session=session,
        seed_admin=seed_admin,
        seed_manager=seed_manager,
        seed_developer=seed_developer,
        auth_header=auth_header,
    )
    manager = landscape["manager"]
    response = client.get(
        "/reports/dashboard", headers=auth_header(manager)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["projects"]["total"] == 4


def test_developer_denied(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = seed_reporting_landscape(
        client=client,
        session=session,
        seed_admin=seed_admin,
        seed_manager=seed_manager,
        seed_developer=seed_developer,
        auth_header=auth_header,
    )
    dev = landscape["developers"][0]
    response = client.get(
        "/reports/dashboard", headers=auth_header(dev)
    )
    assert response.status_code == 403


def test_unauth_returns_401(client):
    response = client.get("/reports/dashboard")
    assert response.status_code == 401


def test_empty_system_zeros_pass_shape(
    client, session, seed_admin, auth_header
):
    admin = seed_admin()
    response = client.get(
        "/reports/dashboard", headers=auth_header(admin)
    )
    assert response.status_code == 200
    body = response.json()
    assert_dashboard_payload_shape(body)
    assert body["projects"]["total"] == 0
    assert body["projects"]["overdue"] == 0
    assert body["developers"]["total"] == 0
    assert Decimal(body["developers"]["average_module_progress"]) == Decimal("0.0")
    assert Decimal(body["payments"]["total_revenue"]) == Decimal("0.00")
    assert Decimal(body["payments"]["pending_amount"]) == Decimal("0.00")


def test_soft_deleted_project_excluded(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = seed_reporting_landscape(
        client=client,
        session=session,
        seed_admin=seed_admin,
        seed_manager=seed_manager,
        seed_developer=seed_developer,
        auth_header=auth_header,
    )
    soft_delete_project(session, landscape["projects"]["pending"])

    response = client.get(
        "/reports/dashboard", headers=landscape["auth_header"]
    )
    assert response.status_code == 200
    body = response.json()
    assert body["projects"]["total"] == 3
    assert body["projects"]["pending"] == 0
