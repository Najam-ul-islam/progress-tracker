"""Reporting module: all business logic. The only legal home for domain rules.

Read-only by contract (Decision 7 in research.md). The audit script
`backend/scripts/audit_reporting_imports.sh` forbids mutation calls
(`session.add/delete/merge/commit`) anywhere under this package.

Sibling-import allow-list (FR-023):

    - app.modules.projects.repository
    - app.modules.payments.repository
    - app.modules.users.repository
    - app.modules.clients.repository
    - app.modules.auth.dependencies
    - app.modules.auth.schema
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from sqlmodel import Session

from app.modules.clients import repository as clients_repo
from app.modules.reporting import repository as reporting_repo
from app.modules.reporting.schema import (
    DashboardSummary,
    DeveloperReportRow,
    DeveloperSelfReport,
    FinancialReportResponse,
    FinancialReportRow,
    FinancialTotals,
    ProjectReportRow,
)
from app.modules.users import repository as users_repo


# ---------- Typed exceptions (per data-model.md / contracts) ----------


class InvalidDateRange(Exception):
    """date_from / date_to bad format or date_from > date_to (FR-017 → 422)."""

    def __init__(self, message: str = "date_from must be on or before date_to") -> None:
        super().__init__(message)


class InvalidProjectStatus(Exception):
    """project_status not in {pending, active, completed} (FR-018 → 422)."""

    def __init__(self) -> None:
        super().__init__(
            "project_status must be one of: pending, active, completed"
        )


class ClientNotFound(Exception):
    """client_id refers to a non-existent or soft-deleted client (FR-019 → 422)."""

    def __init__(self, client_id: int) -> None:
        super().__init__(f"client_id {client_id} not found")


class DeveloperNotFound(Exception):
    """developer_id refers to a non-existent user or non-developer (FR-019 → 422)."""

    def __init__(self, developer_id: int) -> None:
        super().__init__(f"developer_id {developer_id} not found")


# ---------- FilterContext (internal, not exposed) ----------


_VALID_PROJECT_STATUSES = {"pending", "active", "completed"}


@dataclass(frozen=True)
class FilterContext:
    date_from: date | None
    date_to: date | None
    project_status: str | None
    client_id: int | None
    developer_id: int | None


def _parse_date(value: str | None, *, field: str) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise InvalidDateRange(f"{field} must be a valid ISO date (YYYY-MM-DD)") from exc


def _normalise_filters(
    session: Session,
    *,
    date_from: str | date | None,
    date_to: str | date | None,
    project_status: str | None,
    client_id: int | None,
    developer_id: int | None,
) -> FilterContext:
    df = _parse_date(date_from, field="date_from")
    dt = _parse_date(date_to, field="date_to")
    if df is not None and dt is not None and df > dt:
        raise InvalidDateRange()

    if project_status is not None and project_status not in _VALID_PROJECT_STATUSES:
        raise InvalidProjectStatus()

    if client_id is not None:
        client = clients_repo.get_client_by_id(session, client_id)
        if client is None:
            raise ClientNotFound(client_id)

    if developer_id is not None:
        user = users_repo.get_user_by_id(session, developer_id)
        if user is None or user.role != "developer":
            raise DeveloperNotFound(developer_id)

    return FilterContext(
        date_from=df,
        date_to=dt,
        project_status=project_status,
        client_id=client_id,
        developer_id=developer_id,
    )


# ---------- US1: Dashboard ----------


_DECIMAL_ZERO = Decimal("0")
_QUANT_TWO = Decimal("0.01")


def _q2(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(_QUANT_TWO)


def get_dashboard_summary(session: Session) -> DashboardSummary:
    project_counts = reporting_repo.dashboard_project_counts(session)
    developer_metrics = reporting_repo.dashboard_developer_metrics(session)
    payment_aggregates = reporting_repo.dashboard_payment_aggregates(session)

    return DashboardSummary(
        projects=project_counts,
        developers=developer_metrics,
        payments={
            "total_revenue": _q2(payment_aggregates["total_revenue"]),
            "total_company_reserve": _q2(
                payment_aggregates["total_company_reserve"]
            ),
            "total_developer_disbursed": _q2(
                payment_aggregates["total_developer_disbursed"]
            ),
            "pending_amount": _q2(payment_aggregates["pending_amount"]),
        },
    )


# ---------- US2: Projects report ----------


def get_projects_report(
    session: Session,
    *,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    project_status: str | None = None,
    client_id: int | None = None,
    developer_id: int | None = None,
) -> list[ProjectReportRow]:
    ctx = _normalise_filters(
        session,
        date_from=date_from,
        date_to=date_to,
        project_status=project_status,
        client_id=client_id,
        developer_id=developer_id,
    )
    rows = reporting_repo.project_report_rows(session, ctx)
    return [ProjectReportRow.model_validate(r) for r in rows]


# ---------- US3: Developers report ----------


def get_developers_report(
    session: Session,
    *,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    project_status: str | None = None,
    client_id: int | None = None,
    developer_id: int | None = None,
) -> list[DeveloperReportRow]:
    ctx = _normalise_filters(
        session,
        date_from=date_from,
        date_to=date_to,
        project_status=project_status,
        client_id=client_id,
        developer_id=developer_id,
    )
    rows = reporting_repo.developer_report_rows(session, ctx)
    return [DeveloperReportRow.model_validate(r) for r in rows]


# ---------- US4: Financial report ----------


def get_financial_report(
    session: Session,
    *,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    project_status: str | None = None,
    client_id: int | None = None,
) -> FinancialReportResponse:
    ctx = _normalise_filters(
        session,
        date_from=date_from,
        date_to=date_to,
        project_status=project_status,
        client_id=client_id,
        developer_id=None,
    )
    rows, totals = reporting_repo.financial_report_rows(session, ctx)
    return FinancialReportResponse(
        rows=[FinancialReportRow.model_validate(r) for r in rows],
        totals=FinancialTotals.model_validate(totals),
    )


# ---------- US5: Developer self-service ----------


def get_developer_self_report(
    session: Session, current_user: Any
) -> DeveloperSelfReport:
    payload = reporting_repo.developer_self_breakdown(
        session, developer_id=current_user.id
    )
    payload["id"] = current_user.id
    payload["name"] = current_user.name
    return DeveloperSelfReport.model_validate(payload)
