"""US4: GET /reports/payments — per-project profitability + totals."""

from __future__ import annotations

from decimal import Decimal

from tests._reporting_helpers import seed_reporting_landscape


def _seed(client, session, seed_admin, seed_manager, seed_developer, auth_header):
    return seed_reporting_landscape(
        client=client,
        session=session,
        seed_admin=seed_admin,
        seed_manager=seed_manager,
        seed_developer=seed_developer,
        auth_header=auth_header,
    )


def test_admin_full_landscape_rows_and_totals(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/payments", headers=landscape["auth_header"]
    )
    assert response.status_code == 200, response.text
    body = response.json()
    rows = body["rows"]
    assert len(rows) == 4  # all 4 active projects, including overdue + zero-payment ones

    totals = body["totals"]
    sum_invoiced = sum(Decimal(r["invoiced"]) for r in rows)
    sum_company = sum(Decimal(r["company_share"]) for r in rows)
    sum_developer = sum(Decimal(r["developer_share"]) for r in rows)
    sum_outstanding = sum(Decimal(r["outstanding"]) for r in rows)
    assert Decimal(totals["invoiced"]) == sum_invoiced
    assert Decimal(totals["company_share"]) == sum_company
    assert Decimal(totals["developer_share"]) == sum_developer
    assert Decimal(totals["outstanding"]) == sum_outstanding

    # Sanity: 1000 paid + 2000 partial + 3000 pending = 6000 invoiced.
    assert Decimal(totals["invoiced"]) == Decimal("6000.00")


def test_zero_payment_project_still_appears(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/payments", headers=landscape["auth_header"]
    )
    rows = response.json()["rows"]
    # P-Pending and P-Overdue have no payments.
    by_name = {r["project_name"]: r for r in rows}
    assert "P-Pending" in by_name
    assert by_name["P-Pending"]["payment_count"] == 0
    assert Decimal(by_name["P-Pending"]["invoiced"]) == Decimal("0.00")


def test_filter_by_status(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    response = client.get(
        "/reports/payments?project_status=completed",
        headers=landscape["auth_header"],
    )
    rows = response.json()["rows"]
    assert len(rows) == 1
    assert rows[0]["status"] == "completed"


def test_developer_denied(
    client, session, seed_admin, seed_manager, seed_developer, auth_header
):
    landscape = _seed(
        client, session, seed_admin, seed_manager, seed_developer, auth_header
    )
    dev = landscape["developers"][0]
    response = client.get("/reports/payments", headers=auth_header(dev))
    assert response.status_code == 403


def test_unauth_returns_401(client):
    response = client.get("/reports/payments")
    assert response.status_code == 401
