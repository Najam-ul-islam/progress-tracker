"""Payments module: HTTP routing only. Delegates to services.

Every route body is a thin try/except mapping typed service exceptions to
canonical HTTP responses per
`specs/006-payments-distribution/contracts/access-control-matrix.md`.

Guard ordering on every endpoint:
  1. `requester = Depends(require_any(...))`
  2. `session = Depends(get_session)`
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.db.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    require_admin,
    require_any,
)
from app.modules.payments import service as payments_service
from app.modules.payments.schema import (
    DeveloperPaymentMineRead,
    PaymentDetailRead,
    PaymentGenerateRequest,
    PaymentRead,
    PaymentStatusPatch,
    PaymentSummaryRead,
)


router = APIRouter(tags=["payments"])


@router.post(
    "/generate/{project_id}",
    response_model=PaymentDetailRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_payment(
    project_id: int,
    payload: PaymentGenerateRequest,
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> PaymentDetailRead:
    try:
        return payments_service.generate_payment_distribution(
            session,
            project_id=project_id,
            total_amount=payload.total_amount,
            mark_as_paid=payload.mark_as_paid,
        )
    except payments_service.ProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except (
        payments_service.ProjectNotBillable,
        payments_service.ShareSumDrift,
        payments_service.InvalidTotalAmount,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("/summary", response_model=PaymentSummaryRead)
def get_summary(
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> PaymentSummaryRead:
    return payments_service.get_payment_summary(session)


@router.get("/remaining-balance/{project_id}")
def get_remaining_balance(
    project_id: int,
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> dict[str, Any]:
    balance = payments_service.get_remaining_balance(
        session, project_id=project_id
    )
    return {"project_id": project_id, "remaining_balance": balance}


@router.get("/developer/me", response_model=list[DeveloperPaymentMineRead])
def list_my_earnings(
    session: Session = Depends(get_session),
    requester: Any = Depends(require_any("developer")),
) -> list[DeveloperPaymentMineRead]:
    return payments_service.list_my_earnings(
        session, caller_user_id=requester.id
    )


@router.get("/", response_model=list[PaymentRead])
def list_payments(
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> list[PaymentRead]:
    return payments_service.list_payments(session)


@router.get("/{id}", response_model=PaymentDetailRead)
def get_payment(
    id: int,
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> PaymentDetailRead:
    try:
        return payments_service.get_payment_detail(session, id)
    except payments_service.PaymentNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )


@router.patch("/{id}/status", response_model=PaymentDetailRead)
def update_status(
    id: int,
    payload: PaymentStatusPatch,
    session: Session = Depends(get_session),
    requester: Any = Depends(require_admin),
) -> PaymentDetailRead:
    try:
        return payments_service.update_payment_status(
            session,
            payment_id=id,
            payload=payload,
        )
    except payments_service.PaymentNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )
    except (
        payments_service.DeveloperPaymentNotInThisPayment,
        payments_service.MutuallyExclusiveFields,
        payments_service.EmptyStatusPatchBody,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
