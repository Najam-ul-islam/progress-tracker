"""Reporting module: Pydantic v2 response schemas. No tables, no business logic.

All models are read-only DTOs projected from queries against existing tables.
Decimal fields render as JSON strings (Pydantic v2 default).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


_PROJECT_STATUS = Literal["pending", "active", "completed"]
_MODULE_STATUS = Literal["pending", "in_progress", "completed"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


# ---------- US1: Dashboard ----------


class ProjectsBlock(_Strict):
    total: int
    pending: int
    active: int
    completed: int
    overdue: int


class DevelopersBlock(_Strict):
    total: int
    with_active_assignments: int
    average_module_progress: Decimal


class PaymentsBlock(_Strict):
    total_revenue: Decimal
    total_company_reserve: Decimal
    total_developer_disbursed: Decimal
    pending_amount: Decimal


class DashboardSummary(_Strict):
    projects: ProjectsBlock
    developers: DevelopersBlock
    payments: PaymentsBlock


# ---------- US2: Projects report ----------


class ProjectReportModule(_Strict):
    id: int
    name: str
    assigned_developer_id: int
    assigned_developer_name: str
    progress: int
    status: _MODULE_STATUS
    share_percentage: Decimal


class ProjectReportRow(_Strict):
    id: int
    name: str
    client_id: int
    client_name: str
    status: _PROJECT_STATUS
    start_date: date
    end_date: date
    overall_progress: int
    module_count: int
    modules_completed: int
    modules_in_progress: int
    modules_pending: int
    invoiced_amount: Decimal
    outstanding_amount: Decimal
    modules: list[ProjectReportModule]


# ---------- US3: Developers report (also reused by US5 for `earnings`) ----------


class EarningsBlock(_Strict):
    paid: Decimal
    pending: Decimal
    total: Decimal


class EarningsByProject(_Strict):
    project_id: int
    project_name: str
    paid: Decimal
    pending: Decimal
    total: Decimal


class DeveloperReportRow(_Strict):
    id: int
    name: str
    email: EmailStr
    module_count: int
    modules_completed: int
    modules_in_progress: int
    modules_pending: int
    earnings: EarningsBlock
    earnings_by_project: list[EarningsByProject]


# ---------- US4: Financial report ----------


class FinancialReportRow(_Strict):
    project_id: int
    project_name: str
    client_id: int
    client_name: str
    status: _PROJECT_STATUS
    invoiced: Decimal
    company_share: Decimal
    developer_share: Decimal
    outstanding: Decimal
    payment_count: int


class FinancialTotals(_Strict):
    invoiced: Decimal
    company_share: Decimal
    developer_share: Decimal
    outstanding: Decimal


class FinancialReportResponse(_Strict):
    rows: list[FinancialReportRow]
    totals: FinancialTotals


# ---------- US5: Developer self-service ----------


class DeveloperSelfModule(_Strict):
    module_id: int
    module_name: str
    project_id: int
    project_name: str
    progress: int
    status: _MODULE_STATUS
    share_percentage: Decimal
    amount_paid: Decimal
    amount_pending: Decimal


class DeveloperSelfReport(_Strict):
    id: int
    name: str
    module_count: int
    modules_completed: int
    modules_in_progress: int
    modules_pending: int
    earnings: EarningsBlock
    modules: list[DeveloperSelfModule]
