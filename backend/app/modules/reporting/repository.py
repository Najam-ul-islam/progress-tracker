"""Reporting module: all database queries. No business logic, no HTTP concerns.

Read-only by contract. The audit script forbids `session.add/delete/merge/commit`
anywhere under this package.

All queries are SQL-side aggregations (`func.count`, `func.sum`, `func.avg`,
`case`) so we never load full rowsets into Python just to count them. Each
helper is documented with its round-trip count (≤4 per endpoint, SC-005).
"""

from __future__ import annotations

from datetime import date as _date
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import case, func
from sqlmodel import Session, select

from app.modules.clients.model import Client
from app.modules.payments import repository as payments_repo
from app.modules.payments.model import DeveloperPayment, Payment
from app.modules.projects.model import Project, ProjectModule
from app.modules.users.model import User


if TYPE_CHECKING:
    from app.modules.reporting.service import FilterContext


_DEC_ZERO = Decimal("0")
_DEC_ONE_DP = Decimal("0.1")
_DEC_TWO_DP = Decimal("0.01")
_DEV_BASE = Decimal("70")


def _dec(value: Any) -> Decimal:
    if value is None:
        return _DEC_ZERO
    return Decimal(str(value))


# =========================================================================
# US1: Dashboard
# =========================================================================


def dashboard_project_counts(session: Session) -> dict[str, int]:
    """1 round-trip — total/pending/active/completed/overdue (active+past end_date)."""
    overdue_expr = case(
        (
            (Project.status == "active")
            & (Project.end_date < func.current_date())
            & (Project.is_active == True),  # noqa: E712
            1,
        ),
        else_=0,
    )
    stmt = select(
        func.count(Project.id),
        func.coalesce(
            func.sum(case((Project.status == "pending", 1), else_=0)), 0
        ),
        func.coalesce(
            func.sum(case((Project.status == "active", 1), else_=0)), 0
        ),
        func.coalesce(
            func.sum(case((Project.status == "completed", 1), else_=0)), 0
        ),
        func.coalesce(func.sum(overdue_expr), 0),
    ).where(Project.is_active == True)  # noqa: E712
    row = session.execute(stmt).one()
    return {
        "total": int(row[0] or 0),
        "pending": int(row[1] or 0),
        "active": int(row[2] or 0),
        "completed": int(row[3] or 0),
        "overdue": int(row[4] or 0),
    }


def dashboard_developer_metrics(session: Session) -> dict[str, Any]:
    """2 round-trips — total active developers + module engagement aggregates."""
    total_stmt = (
        select(func.count(User.id))
        .where(User.role == "developer", User.is_active == True)  # noqa: E712
    )
    total = int(session.execute(total_stmt).scalar_one() or 0)

    active_modules_stmt = (
        select(
            func.count(func.distinct(ProjectModule.assigned_developer_id)),
            func.avg(ProjectModule.progress),
        )
        .join(Project, Project.id == ProjectModule.project_id)
        .where(
            Project.is_active == True,  # noqa: E712
            ProjectModule.is_active == True,  # noqa: E712
        )
    )
    row = session.execute(active_modules_stmt).one()
    with_assignments = int(row[0] or 0)
    avg_progress = Decimal(str(row[1] or 0)).quantize(_DEC_ONE_DP)

    return {
        "total": total,
        "with_active_assignments": with_assignments,
        "average_module_progress": avg_progress,
    }


def dashboard_payment_aggregates(session: Session) -> dict[str, Decimal]:
    """1 round-trip via payments.summary_aggregates + 1 for pending_amount."""
    base = payments_repo.summary_aggregates(session)
    pending_stmt = select(
        func.coalesce(func.sum(Payment.total_amount), 0)
    ).where(Payment.status != "paid")
    pending_amount = _dec(session.execute(pending_stmt).scalar_one())

    return {
        "total_revenue": _dec(base["total_billed"]),
        "total_company_reserve": _dec(base["total_company_reserve"]),
        "total_developer_disbursed": _dec(base["total_developer_disbursed"]),
        "pending_amount": pending_amount,
    }


# =========================================================================
# US2: Projects report
# =========================================================================


def _apply_project_filters(stmt, ctx: "FilterContext"):
    stmt = stmt.where(Project.is_active == True)  # noqa: E712
    if ctx.project_status is not None:
        stmt = stmt.where(Project.status == ctx.project_status)
    if ctx.client_id is not None:
        stmt = stmt.where(Project.client_id == ctx.client_id)
    if ctx.date_from is not None:
        stmt = stmt.where(Project.created_at >= _date_to_naive(ctx.date_from))
    if ctx.date_to is not None:
        # inclusive upper bound: created_at < (date_to + 1 day) is more
        # idiomatic but the tests use a calendar-day grouping, so we use
        # the simple "date(created_at) <= date_to" via func.date.
        stmt = stmt.where(func.date(Project.created_at) <= ctx.date_to)
    return stmt


def _date_to_naive(d: _date) -> _date:
    """Filters compare against `Project.created_at` which is a datetime; the
    SQL engine accepts a date literal on the left side. Returning the date
    keeps SQLite + Postgres both happy."""
    return d


def project_report_rows(
    session: Session, ctx: "FilterContext"
) -> list[dict[str, Any]]:
    """3 round-trips: projects+clients, modules+developer-name, payment sums.

    Stitched in Python keyed by project_id. No N+1.
    """
    projects_stmt = (
        select(
            Project.id,
            Project.name,
            Project.client_id,
            Client.name,
            Project.status,
            Project.start_date,
            Project.end_date,
        )
        .join(Client, Client.id == Project.client_id)
    )
    projects_stmt = _apply_project_filters(projects_stmt, ctx)

    if ctx.developer_id is not None:
        projects_stmt = projects_stmt.where(
            select(ProjectModule.id)
            .where(
                ProjectModule.project_id == Project.id,
                ProjectModule.assigned_developer_id == ctx.developer_id,
                ProjectModule.is_active == True,  # noqa: E712
            )
            .exists()
        )

    projects_stmt = projects_stmt.order_by(Project.id)
    project_rows = session.execute(projects_stmt).all()
    if not project_rows:
        return []

    project_ids = [r[0] for r in project_rows]

    modules_stmt = (
        select(
            ProjectModule.project_id,
            ProjectModule.id,
            ProjectModule.name,
            ProjectModule.assigned_developer_id,
            User.name,
            ProjectModule.progress,
            ProjectModule.status,
            ProjectModule.share_percentage,
        )
        .join(User, User.id == ProjectModule.assigned_developer_id)
        .where(
            ProjectModule.project_id.in_(project_ids),
            ProjectModule.is_active == True,  # noqa: E712
        )
        .order_by(ProjectModule.project_id, ProjectModule.id)
    )
    module_rows = session.execute(modules_stmt).all()

    payments_stmt = (
        select(
            Payment.project_id,
            func.coalesce(func.sum(Payment.total_amount), 0),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status != "paid", Payment.total_amount),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .where(Payment.project_id.in_(project_ids))
        .group_by(Payment.project_id)
    )
    payments_by_project: dict[int, tuple[Decimal, Decimal]] = {}
    for pid, invoiced, outstanding in session.execute(payments_stmt).all():
        payments_by_project[pid] = (_dec(invoiced), _dec(outstanding))

    modules_by_project: dict[int, list[dict[str, Any]]] = {pid: [] for pid in project_ids}
    for mrow in module_rows:
        (
            pid,
            mid,
            mname,
            dev_id,
            dev_name,
            progress,
            mstatus,
            share,
        ) = mrow
        modules_by_project.setdefault(pid, []).append(
            {
                "id": int(mid),
                "name": mname,
                "assigned_developer_id": int(dev_id),
                "assigned_developer_name": dev_name,
                "progress": int(progress),
                "status": mstatus,
                "share_percentage": _dec(share).quantize(_DEC_TWO_DP),
            }
        )

    out: list[dict[str, Any]] = []
    for pid, pname, cid, cname, pstatus, sdate, edate in project_rows:
        modules = modules_by_project.get(pid, [])
        module_count = len(modules)
        completed = sum(1 for m in modules if m["status"] == "completed")
        in_progress = sum(1 for m in modules if m["status"] == "in_progress")
        pending = sum(1 for m in modules if m["status"] == "pending")
        if modules:
            weighted = sum(
                Decimal(m["progress"]) * m["share_percentage"]
                for m in modules
            )
            overall = int((weighted / _DEV_BASE).to_integral_value())
            overall = max(0, min(100, overall))
        else:
            overall = 0
        invoiced, outstanding = payments_by_project.get(
            pid, (_DEC_ZERO, _DEC_ZERO)
        )
        out.append(
            {
                "id": int(pid),
                "name": pname,
                "client_id": int(cid),
                "client_name": cname,
                "status": pstatus,
                "start_date": sdate,
                "end_date": edate,
                "overall_progress": overall,
                "module_count": module_count,
                "modules_completed": completed,
                "modules_in_progress": in_progress,
                "modules_pending": pending,
                "invoiced_amount": invoiced.quantize(_DEC_TWO_DP),
                "outstanding_amount": outstanding.quantize(_DEC_TWO_DP),
                "modules": modules,
            }
        )
    return out


# =========================================================================
# US3: Developers report
# =========================================================================


def developer_report_rows(
    session: Session, ctx: "FilterContext"
) -> list[dict[str, Any]]:
    """3 round-trips: developer module-status counts, per-project earnings,
    per-developer earnings totals. Stitched by developer_id in Python."""

    devs_stmt = (
        select(
            User.id,
            User.name,
            User.email,
            func.count(ProjectModule.id),
            func.coalesce(
                func.sum(
                    case((ProjectModule.status == "completed", 1), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((ProjectModule.status == "in_progress", 1), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((ProjectModule.status == "pending", 1), else_=0)
                ),
                0,
            ),
        )
        .outerjoin(
            ProjectModule,
            (ProjectModule.assigned_developer_id == User.id)
            & (ProjectModule.is_active == True),  # noqa: E712
        )
        .outerjoin(Project, Project.id == ProjectModule.project_id)
        .where(User.role == "developer", User.is_active == True)  # noqa: E712
        .group_by(User.id, User.name, User.email)
        .order_by(User.id)
    )
    if ctx.developer_id is not None:
        devs_stmt = devs_stmt.where(User.id == ctx.developer_id)

    dev_rows = session.execute(devs_stmt).all()
    if not dev_rows:
        return []

    dev_ids = [int(r[0]) for r in dev_rows]

    # Earnings by (developer, project).
    by_proj_stmt = (
        select(
            DeveloperPayment.developer_id,
            Payment.project_id,
            Project.name,
            func.coalesce(
                func.sum(
                    case(
                        (DeveloperPayment.status == "paid", DeveloperPayment.amount),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (DeveloperPayment.status == "pending", DeveloperPayment.amount),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .join(Payment, Payment.id == DeveloperPayment.payment_id)
        .join(Project, Project.id == Payment.project_id)
        .where(DeveloperPayment.developer_id.in_(dev_ids))
        .group_by(
            DeveloperPayment.developer_id,
            Payment.project_id,
            Project.name,
        )
        .order_by(
            DeveloperPayment.developer_id,
            Payment.project_id,
        )
    )
    by_proj: dict[int, list[dict[str, Any]]] = {did: [] for did in dev_ids}
    totals_paid: dict[int, Decimal] = {did: _DEC_ZERO for did in dev_ids}
    totals_pending: dict[int, Decimal] = {did: _DEC_ZERO for did in dev_ids}
    for did, pid, pname, paid, pending in session.execute(by_proj_stmt).all():
        did_i = int(did)
        paid_d = _dec(paid).quantize(_DEC_TWO_DP)
        pending_d = _dec(pending).quantize(_DEC_TWO_DP)
        by_proj.setdefault(did_i, []).append(
            {
                "project_id": int(pid),
                "project_name": pname,
                "paid": paid_d,
                "pending": pending_d,
                "total": (paid_d + pending_d).quantize(_DEC_TWO_DP),
            }
        )
        totals_paid[did_i] = totals_paid.get(did_i, _DEC_ZERO) + paid_d
        totals_pending[did_i] = totals_pending.get(did_i, _DEC_ZERO) + pending_d

    out: list[dict[str, Any]] = []
    for (
        uid,
        uname,
        uemail,
        mc,
        mc_done,
        mc_in_progress,
        mc_pending,
    ) in dev_rows:
        did_i = int(uid)
        paid_d = totals_paid.get(did_i, _DEC_ZERO).quantize(_DEC_TWO_DP)
        pending_d = totals_pending.get(did_i, _DEC_ZERO).quantize(_DEC_TWO_DP)
        out.append(
            {
                "id": did_i,
                "name": uname,
                "email": uemail,
                "module_count": int(mc or 0),
                "modules_completed": int(mc_done or 0),
                "modules_in_progress": int(mc_in_progress or 0),
                "modules_pending": int(mc_pending or 0),
                "earnings": {
                    "paid": paid_d,
                    "pending": pending_d,
                    "total": (paid_d + pending_d).quantize(_DEC_TWO_DP),
                },
                "earnings_by_project": by_proj.get(did_i, []),
            }
        )
    return out


# =========================================================================
# US4: Financial report
# =========================================================================


def financial_report_rows(
    session: Session, ctx: "FilterContext"
) -> tuple[list[dict[str, Any]], dict[str, Decimal]]:
    """2 round-trips: projects+clients (filtered), payment sums by project."""
    projects_stmt = (
        select(
            Project.id,
            Project.name,
            Project.client_id,
            Client.name,
            Project.status,
        )
        .join(Client, Client.id == Project.client_id)
    )
    projects_stmt = _apply_project_filters(projects_stmt, ctx)
    projects_stmt = projects_stmt.order_by(Project.id)
    projects = session.execute(projects_stmt).all()

    if not projects:
        zero_totals = {
            "invoiced": _DEC_ZERO.quantize(_DEC_TWO_DP),
            "company_share": _DEC_ZERO.quantize(_DEC_TWO_DP),
            "developer_share": _DEC_ZERO.quantize(_DEC_TWO_DP),
            "outstanding": _DEC_ZERO.quantize(_DEC_TWO_DP),
        }
        return [], zero_totals

    project_ids = [r[0] for r in projects]
    pay_stmt = (
        select(
            Payment.project_id,
            func.coalesce(func.sum(Payment.total_amount), 0),
            func.coalesce(func.sum(Payment.company_amount), 0),
            func.coalesce(func.sum(Payment.developer_amount), 0),
            func.coalesce(
                func.sum(
                    case(
                        (Payment.status != "paid", Payment.total_amount),
                        else_=0,
                    )
                ),
                0,
            ),
            func.count(Payment.id),
        )
        .where(Payment.project_id.in_(project_ids))
        .group_by(Payment.project_id)
    )
    pay_by_proj: dict[int, tuple[Decimal, Decimal, Decimal, Decimal, int]] = {}
    for pid, inv, comp, dev, out, cnt in session.execute(pay_stmt).all():
        pay_by_proj[int(pid)] = (
            _dec(inv),
            _dec(comp),
            _dec(dev),
            _dec(out),
            int(cnt or 0),
        )

    rows: list[dict[str, Any]] = []
    tot_inv = tot_comp = tot_dev = tot_out = _DEC_ZERO
    for pid, pname, cid, cname, pstatus in projects:
        inv, comp, dev, out, cnt = pay_by_proj.get(
            int(pid), (_DEC_ZERO, _DEC_ZERO, _DEC_ZERO, _DEC_ZERO, 0)
        )
        rows.append(
            {
                "project_id": int(pid),
                "project_name": pname,
                "client_id": int(cid),
                "client_name": cname,
                "status": pstatus,
                "invoiced": inv.quantize(_DEC_TWO_DP),
                "company_share": comp.quantize(_DEC_TWO_DP),
                "developer_share": dev.quantize(_DEC_TWO_DP),
                "outstanding": out.quantize(_DEC_TWO_DP),
                "payment_count": cnt,
            }
        )
        tot_inv += inv
        tot_comp += comp
        tot_dev += dev
        tot_out += out

    totals = {
        "invoiced": tot_inv.quantize(_DEC_TWO_DP),
        "company_share": tot_comp.quantize(_DEC_TWO_DP),
        "developer_share": tot_dev.quantize(_DEC_TWO_DP),
        "outstanding": tot_out.quantize(_DEC_TWO_DP),
    }
    return rows, totals


# =========================================================================
# US5: Developer self-service
# =========================================================================


def developer_self_breakdown(
    session: Session, *, developer_id: int
) -> dict[str, Any]:
    """2 round-trips: modules+project info, developer_payment sums by module."""
    modules_stmt = (
        select(
            ProjectModule.id,
            ProjectModule.name,
            ProjectModule.project_id,
            Project.name,
            ProjectModule.progress,
            ProjectModule.status,
            ProjectModule.share_percentage,
        )
        .join(Project, Project.id == ProjectModule.project_id)
        .where(
            ProjectModule.assigned_developer_id == developer_id,
            ProjectModule.is_active == True,  # noqa: E712
            Project.is_active == True,  # noqa: E712
        )
        .order_by(ProjectModule.id)
    )
    module_rows = session.execute(modules_stmt).all()

    earn_stmt = (
        select(
            DeveloperPayment.module_id,
            func.coalesce(
                func.sum(
                    case(
                        (DeveloperPayment.status == "paid", DeveloperPayment.amount),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (DeveloperPayment.status == "pending", DeveloperPayment.amount),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .where(DeveloperPayment.developer_id == developer_id)
        .group_by(DeveloperPayment.module_id)
    )
    earn_by_module: dict[int, tuple[Decimal, Decimal]] = {}
    for mid, paid, pending in session.execute(earn_stmt).all():
        earn_by_module[int(mid)] = (
            _dec(paid).quantize(_DEC_TWO_DP),
            _dec(pending).quantize(_DEC_TWO_DP),
        )

    modules: list[dict[str, Any]] = []
    total_paid = total_pending = _DEC_ZERO
    completed = in_progress = pending_count = 0
    for mid, mname, pid, pname, progress, mstatus, share in module_rows:
        paid, pend = earn_by_module.get(int(mid), (_DEC_ZERO, _DEC_ZERO))
        modules.append(
            {
                "module_id": int(mid),
                "module_name": mname,
                "project_id": int(pid),
                "project_name": pname,
                "progress": int(progress),
                "status": mstatus,
                "share_percentage": _dec(share).quantize(_DEC_TWO_DP),
                "amount_paid": paid,
                "amount_pending": pend,
            }
        )
        total_paid += paid
        total_pending += pend
        if mstatus == "completed":
            completed += 1
        elif mstatus == "in_progress":
            in_progress += 1
        else:
            pending_count += 1

    return {
        "module_count": len(modules),
        "modules_completed": completed,
        "modules_in_progress": in_progress,
        "modules_pending": pending_count,
        "earnings": {
            "paid": total_paid.quantize(_DEC_TWO_DP),
            "pending": total_pending.quantize(_DEC_TWO_DP),
            "total": (total_paid + total_pending).quantize(_DEC_TWO_DP),
        },
        "modules": modules,
    }
