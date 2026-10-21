"""Reporting module: HTTP routing only. Delegates to services.

No business logic in routes (FR-024). Each route is a thin try/except
mapping typed service exceptions to canonical HTTP responses.

Guard ordering on every endpoint: 401 → 403 → 404 → 422 (FR-016).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.modules.auth.dependencies import (
    get_current_user,
    require_any,
)
from app.modules.reporting import service as reporting_service
from app.modules.reporting.schema import (
    DashboardSummary,
    DeveloperReportRow,
    DeveloperSelfReport,
    FinancialReportResponse,
    ProjectReportRow,
)


router = APIRouter(tags=["reporting"])


def _map_filter_exception(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=str(exc),
    )


@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard(
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> DashboardSummary:
    return reporting_service.get_dashboard_summary(session)


@router.get("/projects", response_model=list[ProjectReportRow])
def get_projects_report(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    project_status: str | None = Query(None),
    client_id: int | None = Query(None, ge=1),
    developer_id: int | None = Query(None, ge=1),
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> list[ProjectReportRow]:
    try:
        return reporting_service.get_projects_report(
            session,
            date_from=date_from,
            date_to=date_to,
            project_status=project_status,
            client_id=client_id,
            developer_id=developer_id,
        )
    except (
        reporting_service.InvalidDateRange,
        reporting_service.InvalidProjectStatus,
        reporting_service.ClientNotFound,
        reporting_service.DeveloperNotFound,
    ) as exc:
        raise _map_filter_exception(exc)


@router.get("/developers/me", response_model=DeveloperSelfReport)
def get_developer_self_report(
    session: Session = Depends(get_session),
    requester: Any = Depends(require_any("developer")),
) -> DeveloperSelfReport:
    return reporting_service.get_developer_self_report(session, requester)


@router.get("/developers", response_model=list[DeveloperReportRow])
def get_developers_report(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    project_status: str | None = Query(None),
    client_id: int | None = Query(None, ge=1),
    developer_id: int | None = Query(None, ge=1),
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> list[DeveloperReportRow]:
    try:
        return reporting_service.get_developers_report(
            session,
            date_from=date_from,
            date_to=date_to,
            project_status=project_status,
            client_id=client_id,
            developer_id=developer_id,
        )
    except (
        reporting_service.InvalidDateRange,
        reporting_service.InvalidProjectStatus,
        reporting_service.ClientNotFound,
        reporting_service.DeveloperNotFound,
    ) as exc:
        raise _map_filter_exception(exc)


@router.get("/payments", response_model=FinancialReportResponse)
def get_financial_report(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    project_status: str | None = Query(None),
    client_id: int | None = Query(None, ge=1),
    session: Session = Depends(get_session),
    _requester: Any = Depends(require_any("admin", "manager")),
) -> FinancialReportResponse:
    try:
        return reporting_service.get_financial_report(
            session,
            date_from=date_from,
            date_to=date_to,
            project_status=project_status,
            client_id=client_id,
        )
    except (
        reporting_service.InvalidDateRange,
        reporting_service.InvalidProjectStatus,
        reporting_service.ClientNotFound,
    ) as exc:
        raise _map_filter_exception(exc)
