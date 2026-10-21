"""Payments module: all database queries. No business logic, no HTTP concerns.

Immutable ledger writes; the only mutation is `developer_payment.status`
flipping `pending → paid` (monotonic) and the parent `payment.status`
re-derivation. Each helper is a single statement (or a tightly-scoped
transactional block for atomic generation).
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func
from sqlmodel import Session, select

from app.modules.payments.model import DeveloperPayment, Payment


# ---------- Generation (US1) ----------


def insert_payment_with_children(
    session: Session,
    payment: Payment,
    children: list[DeveloperPayment],
) -> Payment:
    """Atomic INSERT: parent + N children in one transaction (R1)."""
    session.add(payment)
    session.flush()  # populate payment.id without committing
    assert payment.id is not None
    for child in children:
        child.payment_id = payment.id
        session.add(child)
    session.commit()
    session.refresh(payment)
    for child in children:
        session.refresh(child)
    return payment


# ---------- Read (US1, US2) ----------


def get_payment(session: Session, payment_id: int) -> Payment | None:
    statement = select(Payment).where(Payment.id == payment_id).limit(1)
    return session.exec(statement).first()


def list_payment_children(
    session: Session, payment_id: int
) -> list[DeveloperPayment]:
    statement = (
        select(DeveloperPayment)
        .where(DeveloperPayment.payment_id == payment_id)
        .order_by(DeveloperPayment.id)
    )
    return list(session.exec(statement).all())


def list_payments(
    session: Session, project_id: int | None = None
) -> list[Payment]:
    statement = select(Payment)
    if project_id is not None:
        statement = statement.where(Payment.project_id == project_id)
    statement = statement.order_by(Payment.id)
    return list(session.exec(statement).all())


# ---------- Developer self-service (US3) ----------


def list_developer_payments_for_user(
    session: Session, developer_id: int
) -> list[tuple[DeveloperPayment, int]]:
    """Returns (child, project_id) pairs for the developer.

    Joins `payment` to expose `project_id` for the denormalised mine-shape.
    Stable order: created_at asc, then id asc.
    """
    statement = (
        select(DeveloperPayment, Payment.project_id)
        .join(Payment, Payment.id == DeveloperPayment.payment_id)
        .where(DeveloperPayment.developer_id == developer_id)
        .order_by(DeveloperPayment.created_at, DeveloperPayment.id)
    )
    return [
        (row[0], row[1]) for row in session.exec(statement).all()
    ]


# ---------- Status transitions (US4) ----------


def get_developer_payment(
    session: Session, developer_payment_id: int
) -> DeveloperPayment | None:
    statement = (
        select(DeveloperPayment)
        .where(DeveloperPayment.id == developer_payment_id)
        .limit(1)
    )
    return session.exec(statement).first()


def mark_developer_payment_paid(
    session: Session, developer_payment_id: int
) -> None:
    child = session.get(DeveloperPayment, developer_payment_id)
    if child is not None and child.status != "paid":
        child.status = "paid"
        session.add(child)
        session.commit()


def mark_all_pending_paid(session: Session, payment_id: int) -> None:
    statement = select(DeveloperPayment).where(
        DeveloperPayment.payment_id == payment_id,
        DeveloperPayment.status == "pending",
    )
    pending = list(session.exec(statement).all())
    for child in pending:
        child.status = "paid"
        session.add(child)
    if pending:
        session.commit()


def update_payment_status(
    session: Session, payment: Payment, status: str
) -> Payment:
    payment.status = status
    session.add(payment)
    session.commit()
    session.refresh(payment)
    return payment


# ---------- Summary (US5) ----------


def summary_aggregates(session: Session) -> dict:
    """Single SUM/COUNT pass over `payment` grouped by status.

    Returns a dict shaped for the service layer:
      {
        "total_billed": Decimal,
        "total_company_reserve": Decimal,
        "total_developer_disbursed": Decimal,
        "by_status": {
            "pending": (count, sum_total_amount),
            "partial": (count, sum_total_amount),
            "paid":    (count, sum_total_amount),
        }
      }
    """
    totals_stmt = select(
        func.coalesce(func.sum(Payment.total_amount), 0),
        func.coalesce(func.sum(Payment.company_amount), 0),
        func.coalesce(func.sum(Payment.developer_amount), 0),
    )
    totals_row = session.execute(totals_stmt).one()
    total_billed = Decimal(str(totals_row[0] or 0))
    total_company = Decimal(str(totals_row[1] or 0))
    total_developer = Decimal(str(totals_row[2] or 0))

    by_status_stmt = (
        select(
            Payment.status,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.total_amount), 0),
        )
        .group_by(Payment.status)
    )
    rows = session.execute(by_status_stmt).all()
    buckets: dict[str, tuple[int, Decimal]] = {
        "pending": (0, Decimal("0")),
        "partial": (0, Decimal("0")),
        "paid": (0, Decimal("0")),
    }
    for status, count, sum_amount in rows:
        buckets[status] = (int(count), Decimal(str(sum_amount or 0)))

    return {
        "total_billed": total_billed,
        "total_company_reserve": total_company,
        "total_developer_disbursed": total_developer,
        "by_status": buckets,
    }
