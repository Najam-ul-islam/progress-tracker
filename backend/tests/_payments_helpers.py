"""Shared helpers for payments tests (not a test file — leading underscore)."""

from __future__ import annotations

from decimal import Decimal


def seed_payment_for_project(
    client,
    *,
    project_id: int,
    total_amount: str,
    auth_header: dict,
) -> dict:
    """POST /payments/generate/{project_id} and return the JSON body."""
    response = client.post(
        f"/payments/generate/{project_id}",
        json={"total_amount": total_amount},
        headers=auth_header,
    )
    assert response.status_code == 201, response.text
    return response.json()


def assert_sum_invariants(payment: dict) -> None:
    """SC-001: company + developer == total; sum(child.amount) == developer."""
    total = Decimal(payment["total_amount"])
    company = Decimal(payment["company_amount"])
    developer = Decimal(payment["developer_amount"])
    assert company + developer == total, (
        f"company({company}) + developer({developer}) != total({total})"
    )
    children_sum = sum(
        (Decimal(c["amount"]) for c in payment["developer_breakdown"]),
        Decimal("0"),
    )
    assert children_sum == developer, (
        f"sum(child.amount)={children_sum} != developer_amount={developer}"
    )
