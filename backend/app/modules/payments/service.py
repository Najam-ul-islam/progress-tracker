"""Payments module: all business logic. Use decimal.Decimal for financial arithmetic.

Routes call into this module; this module calls `payments.repository` for
persistence, plus the read-only helpers `projects.repository` (allow-list).

Exceptions raised here are translated by the routes layer per
`contracts/access-control-matrix.md`.
"""

from __future__ import annotations

import logging
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Any, Iterable

from sqlmodel import Session

from app.modules.payments import repository as payments_repo
from app.modules.payments.model import DeveloperPayment, Payment
from app.modules.payments.schema import (
    DeveloperPaymentMineRead,
    DeveloperPaymentRead,
    PaymentDetailRead,
    PaymentRead,
    PaymentStatusPatch,
    PaymentSummaryBucket,
    PaymentSummaryRead,
)
from app.modules.projects import repository as projects_repo


logger = logging.getLogger(__name__)


_QUANT = Decimal("0.01")
_COMPANY_PCT = Decimal("0.30")
_DEVELOPER_PCT = Decimal("0.70")
_DEVELOPER_BASE = Decimal("70")
_BILLABLE_STATUSES = {"active", "completed"}


# ---------- Typed exceptions (per access-control-matrix.md) ----------


class ProjectNotFound(Exception):
    """Project id missing or soft-deleted (FR-001 → HTTP 404)."""

    def __init__(self) -> None:
        super().__init__("project not found")


class ProjectNotBillable(Exception):
    """Project status is not active|completed (FR-001 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("project is not yet active")


class ShareSumDrift(Exception):
    """Active module shares no longer sum to 70.00 (FR-005 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("module shares no longer sum to 70.00")


class InvalidTotalAmount(Exception):
    """`total_amount` <= 0 (FR-002 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("total_amount must be greater than zero")


class PaymentNotFound(Exception):
    """Payment id missing (FR-006 → HTTP 404)."""

    def __init__(self) -> None:
        super().__init__("payment not found")


class DeveloperPaymentNotInThisPayment(Exception):
    """developer_payment_id belongs to a different Payment (FR-012 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__(
            "developer_payment_id does not belong to this payment"
        )


class MutuallyExclusiveFields(Exception):
    """Both `developer_payment_id` and `target` supplied (FR-012 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__(
            "developer_payment_id and target are mutually exclusive"
        )


class EmptyStatusPatchBody(Exception):
    """Neither field supplied (FR-012 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__(
            "must specify either developer_payment_id or target"
        )


# ---------- Distribution helper (R3) ----------


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(_QUANT, rounding=ROUND_HALF_EVEN)


def _distribute(
    developer_amount: Decimal, modules: list[Any]
) -> list[tuple[Any, Decimal]]:
    """Per-module slice with banker's rounding + residual absorption.

    Pre-conditions enforced by caller:
      - sum(m.share_percentage for m in modules) == Decimal("70.00")
      - each m has a non-null assigned_developer_id

    Returns [(module, amount), ...] with sum(amount) == developer_amount exactly.
    Residual is absorbed by the largest-share child; ties broken by
    `assigned_developer_id` ascending.
    """
    slices: list[tuple[ProjectModule, Decimal]] = []
    for m in modules:
        raw = developer_amount * m.share_percentage / _DEVELOPER_BASE
        slices.append((m, _quantize(raw)))

    residual = developer_amount - sum(amount for _, amount in slices)
    if residual != Decimal("0"):
        # Largest share first; ties broken by lowest assigned_developer_id.
        target_idx = max(
            range(len(slices)),
            key=lambda i: (
                slices[i][0].share_percentage,
                -slices[i][0].assigned_developer_id,
            ),
        )
        m, amt = slices[target_idx]
        slices[target_idx] = (m, amt + residual)
    return slices


# ---------- Status derivation (R2) ----------


def _derive_parent_status(children: Iterable[DeveloperPayment]) -> str:
    children = list(children)
    if not children:
        return "pending"
    paid_count = sum(1 for c in children if c.status == "paid")
    if paid_count == len(children):
        return "paid"
    if paid_count == 0:
        return "pending"
    return "partial"


# ---------- Shape helpers ----------


def _to_detail_read(
    payment: Payment, children: list[DeveloperPayment]
) -> PaymentDetailRead:
    return PaymentDetailRead(
        id=payment.id,  # type: ignore[arg-type]
        project_id=payment.project_id,
        total_amount=payment.total_amount,
        company_amount=payment.company_amount,
        developer_amount=payment.developer_amount,
        status=payment.status,  # type: ignore[arg-type]
        created_at=payment.created_at,
        developer_breakdown=[
            DeveloperPaymentRead.model_validate(c) for c in children
        ],
    )


# ---------- Generate (US1, FR-001..005, FR-018) ----------


def generate_payment_distribution(
    session: Session,
    project_id: int,
    total_amount: Decimal,
) -> PaymentDetailRead:
    if total_amount <= Decimal("0"):
        raise InvalidTotalAmount()

    project = projects_repo.get_project_by_id(session, project_id)
    if project is None:
        raise ProjectNotFound()
    if project.status not in _BILLABLE_STATUSES:
        raise ProjectNotBillable()

    modules = projects_repo.list_active_modules(session, project_id)
    share_sum = sum(
        (m.share_percentage for m in modules), Decimal("0")
    )
    if share_sum != _DEVELOPER_BASE:
        raise ShareSumDrift()

    company_amount = _quantize(total_amount * _COMPANY_PCT)
    developer_amount = _quantize(total_amount * _DEVELOPER_PCT)
    # Sum-invariant defensive: total_amount may differ from
    # company + developer due to quantization (e.g. total=0.01).
    drift = total_amount - company_amount - developer_amount
    if drift != Decimal("0"):
        developer_amount += drift

    slices = _distribute(developer_amount, list(modules))

    payment = Payment(
        project_id=project_id,
        total_amount=_quantize(total_amount),
        company_amount=company_amount,
        developer_amount=developer_amount,
        status="pending",
    )
    children = [
        DeveloperPayment(
            payment_id=0,  # filled by repository.insert_payment_with_children
            developer_id=m.assigned_developer_id,
            module_id=m.id,  # type: ignore[arg-type]
            share_percentage=m.share_percentage,
            amount=amount,
            status="pending",
        )
        for m, amount in slices
    ]

    payment = payments_repo.insert_payment_with_children(
        session, payment, children
    )
    persisted_children = payments_repo.list_payment_children(
        session, payment.id  # type: ignore[arg-type]
    )
    logger.info(
        "payment.generated payment_id=%s project_id=%s total_amount=%s children=%s",
        payment.id,
        project_id,
        payment.total_amount,
        len(persisted_children),
    )
    return _to_detail_read(payment, persisted_children)


# ---------- Read (US2) ----------


def list_payments(
    session: Session, project_id: int | None = None
) -> list[PaymentRead]:
    rows = payments_repo.list_payments(session, project_id=project_id)
    return [PaymentRead.model_validate(p) for p in rows]


def get_payment_detail(
    session: Session, payment_id: int
) -> PaymentDetailRead:
    payment = payments_repo.get_payment(session, payment_id)
    if payment is None:
        raise PaymentNotFound()
    children = payments_repo.list_payment_children(session, payment_id)
    return _to_detail_read(payment, children)


# ---------- Developer self-service (US3, FR-008) ----------


def list_my_earnings(
    session: Session, caller_user_id: int
) -> list[DeveloperPaymentMineRead]:
    pairs = payments_repo.list_developer_payments_for_user(
        session, caller_user_id
    )
    return [
        DeveloperPaymentMineRead(
            id=child.id,  # type: ignore[arg-type]
            payment_id=child.payment_id,
            developer_id=child.developer_id,
            module_id=child.module_id,
            project_id=project_id,
            share_percentage=child.share_percentage,
            amount=child.amount,
            status=child.status,  # type: ignore[arg-type]
            created_at=child.created_at,
        )
        for child, project_id in pairs
    ]


# ---------- Status PATCH (US4, FR-011, FR-012) ----------


def update_payment_status(
    session: Session,
    payment_id: int,
    payload: PaymentStatusPatch,
) -> PaymentDetailRead:
    # Defensive re-checks: schema validator guards happy path; keep typed
    # exceptions for stable HTTP detail messages.
    if (
        payload.developer_payment_id is None
        and payload.target is None
    ):
        raise EmptyStatusPatchBody()
    if (
        payload.developer_payment_id is not None
        and payload.target is not None
    ):
        raise MutuallyExclusiveFields()

    payment = payments_repo.get_payment(session, payment_id)
    if payment is None:
        raise PaymentNotFound()

    if payload.developer_payment_id is not None:
        child = payments_repo.get_developer_payment(
            session, payload.developer_payment_id
        )
        if child is None or child.payment_id != payment_id:
            raise DeveloperPaymentNotInThisPayment()
        payments_repo.mark_developer_payment_paid(
            session, payload.developer_payment_id
        )
    else:
        # target == "all"
        payments_repo.mark_all_pending_paid(session, payment_id)

    children = payments_repo.list_payment_children(session, payment_id)
    new_status = _derive_parent_status(children)
    if payment.status != new_status:
        payment = payments_repo.update_payment_status(
            session, payment, new_status
        )
    logger.info(
        "payment.status_updated payment_id=%s status=%s",
        payment.id,
        payment.status,
    )
    return _to_detail_read(payment, children)


# ---------- Summary (US5, FR-020) ----------


def get_payment_summary(session: Session) -> PaymentSummaryRead:
    aggregates = payments_repo.summary_aggregates(session)
    by_status_raw = aggregates["by_status"]
    by_status = {
        status: PaymentSummaryBucket(count=count, sum=_quantize(amount))
        for status, (count, amount) in by_status_raw.items()
    }
    return PaymentSummaryRead(
        total_billed=_quantize(aggregates["total_billed"]),
        total_company_reserve=_quantize(aggregates["total_company_reserve"]),
        total_developer_disbursed=_quantize(
            aggregates["total_developer_disbursed"]
        ),
        by_status=by_status,
    )
