"""Projects module: all business logic. The only legal home for domain rules.

Routes call into this module; this module calls `projects.repository` for
persistence, plus the read-only helpers `clients.repository.get_client_by_id`
and `users.repository.get_user_by_id` (FR-027 allow-list). Exceptions raised
here are translated by the routes layer per
`contracts/access-control-matrix.md` §"Service-layer exception → HTTP mapping".
"""

from __future__ import annotations

import logging
from datetime import date as Date
from decimal import Decimal
from typing import Any

from sqlmodel import Session

from app.modules.clients import repository as clients_repo
from app.modules.notifications import service as notifications_service
from app.modules.payments import service as payments_service
from app.modules.projects import repository as projects_repo
from app.modules.projects.schema import (
    DeveloperModuleView,
    DeveloperProgressModule,
    DeveloperProgressResponse,
    DeveloperProjectView,
    ModuleCreate,
    ModuleProgressSummary,
    ModuleProgressUpdate,
    ModuleRead,
    ModuleUpdate,
    ProjectCreate,
    ProjectProgressResponse,
    ProjectRead,
    ProjectUpdate,
)
from app.modules.users import repository as users_repo


logger = logging.getLogger(__name__)


_CAP = Decimal("70.00")
# Advance payment gate: a project may activate once the client has paid at least
# 30% of the total up front. The 30%–50% *range* is enforced at advance-invoice
# generation (and on the frontend form); the activation gate only enforces the
# 30% floor so that paying more than 50% up front never blocks activation.
_ADVANCE_MIN_PCT = Decimal("0.30")


# ---------- Typed exceptions (per contracts/access-control-matrix.md) ----------


class ProjectNotFoundError(Exception):
    """Project id missing or soft-deleted (FR-026 → HTTP 404)."""


class ModuleNotFoundError(Exception):
    """Module id missing or soft-deleted (FR-026 → HTTP 404)."""


class ClientNotActiveError(Exception):
    """`client_id` does not reference an active client (FR-005 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("client_id does not reference an active client")


class DeveloperNotEligibleError(Exception):
    """`assigned_developer_id` not a developer or not active (FR-009 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__(
            "assigned_developer_id must reference an active user with role=developer"
        )


class ShareCapExceededError(Exception):
    """Sum of active module shares would exceed 70.00 (FR-010 / FR-011 → HTTP 422)."""

    def __init__(self, *, current: Decimal, requested: Decimal) -> None:
        super().__init__(
            f"total module share would exceed 70.00 (current: {current}, requested: {requested})"
        )
        self.current = current
        self.requested = requested


class ActivationGateError(Exception):
    """Activation requires sum == 70.00 (FR-013 → HTTP 422)."""

    def __init__(self, *, current: Decimal) -> None:
        super().__init__(
            f"module shares must sum to exactly 70.00 to activate (current: {current})"
        )
        self.current = current


class AdvancePaymentRequiredError(Exception):
    """Activation requires at least a 30% advance payment (FR-013 → HTTP 422)."""

    def __init__(self, *, paid: Decimal, required: Decimal) -> None:
        super().__init__(
            f"30% advance payment required to activate (paid: {paid}, required: {required})"
        )
        self.paid = paid
        self.required = required


class IllegalStatusTransitionError(Exception):
    """Backwards transition or non-pending → active (FR-014 / FR-015 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("illegal status transition")


class CompletedProjectFrozenError(Exception):
    """Module mutation on completed project (FR-016 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("cannot mutate modules on a completed project")


class ProgressNotPermittedError(Exception):
    """Progress write on non-active project (FR-021 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("cannot update progress on a non-active project")


class DeveloperNotAssignedError(Exception):
    """Developer caller is not the module's assignee (FR-019 → HTTP 403)."""


class DateRangeError(Exception):
    """Merged end_date < start_date (FR-006 → HTTP 422)."""

    def __init__(self) -> None:
        super().__init__("end_date must be on or after start_date")


# ---------- Helpers ----------


def _derive_module_status(progress: int) -> str:
    """FR-020: status derived from progress on every write."""
    if progress == 0:
        return "pending"
    if progress == 100:
        return "completed"
    return "in_progress"


def _maybe_autocomplete_project(session: Session, project: Any) -> None:
    """FR-014: flip `active → completed` when every active module is at 100.

    Invoked from every module write path. No-op if the project is not active,
    or has zero active modules, or any active module is below 100.
    """
    if project.status != "active":
        return
    modules = projects_repo.list_active_modules(session, project.id)
    if not modules:
        return
    if all(m.progress == 100 for m in modules):
        projects_repo.update_project(session, project, status="completed")
        logger.info(
            "projects.autocomplete: project_id=%s flipped active→completed",
            project.id,
        )
        # Auto-bill remaining balance on completion (Hybrid Option 3).
        balance = payments_service.get_remaining_balance(
            session, project_id=project.id
        )
        if balance > Decimal("0"):
            try:
                payments_service.generate_payment_distribution(
                    session, project_id=project.id, total_amount=balance
                )
                logger.info(
                    "projects.autocomplete: auto-billed remaining balance amount=%s project_id=%s",
                    balance,
                    project.id,
                )
            except Exception:
                # Log but don't fail project completion if billing fails.
                logger.exception(
                    "projects.autocomplete: failed to auto-bill remaining balance project_id=%s",
                    project.id,
                )


def _ensure_active_developer(session: Session, user_id: int) -> None:
    user = users_repo.get_user_by_id(session, user_id)
    if user is None or user.role != "developer" or not user.is_active:
        raise DeveloperNotEligibleError()


def _build_developer_project_view(
    session: Session, project: Any, user_id: int
) -> DeveloperProjectView:
    modules = [
        m
        for m in projects_repo.list_active_modules(session, project.id)
        if m.assigned_developer_id == user_id
    ]
    module_views = []
    for m in modules:
        module_allocation = (project.total_amount * m.share_percentage / Decimal("100")).quantize(Decimal("0.01"))
        earned_amount = (module_allocation * Decimal(m.progress) / Decimal("100")).quantize(Decimal("0.01"))
        module_views.append(
            DeveloperModuleView(
                id=m.id,
                name=m.name,
                progress=m.progress,
                status=m.status,
                module_allocation=module_allocation,
                earned_amount=earned_amount,
            )
        )
    return DeveloperProjectView(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        is_active=project.is_active,
        modules=module_views,
    )


def _try_notify(
    session: Session,
    *,
    recipient_id: int,
    title: str,
    message: str,
    type_: str,
    context: str,
) -> None:
    try:
        notifications_service.publish(
            session,
            recipient_id=recipient_id,
            title=title,
            message=message,
            type=type_,
        )
    except Exception:
        logger.exception(
            "projects.notification_failed type=%s recipient_id=%s %s",
            type_,
            recipient_id,
            context,
        )


def _notify_assignment(
    session: Session,
    *,
    developer_id: int,
    module_name: str,
    project_name: str,
) -> None:
    _try_notify(
        session,
        recipient_id=developer_id,
        title=f"Assigned to module: {module_name}",
        message=f"You have been assigned to module '{module_name}' on project '{project_name}'.",
        type_="assignment",
        context=f"module={module_name} project={project_name}",
    )


def _notify_progress_update(
    session: Session,
    *,
    module_name: str,
    project_name: str,
    developer_name: str,
    progress: int,
) -> None:
    title = f"Progress updated: {module_name}"
    message = (
        f"Developer '{developer_name}' updated progress on module "
        f"'{module_name}' in project '{project_name}' to {progress}%."
    )
    # TODO: When a project-owner-admin field is added to Project or ProjectModule,
    # replace this fan-out with a targeted notification to that specific admin.
    # Fan-out to all active admins is the current correct approach because no
    # owner field exists (see spec 016-scoped-financial-visibility decision).
    for admin in users_repo.list_active_admins(session):
        _try_notify(
            session,
            recipient_id=admin.id,
            title=title,
            message=message,
            type_="progress_update",
            context=f"module={module_name} project={project_name} admin={admin.id}",
        )


# ---------- Project operations ----------


def create_project(
    session: Session, *, payload: ProjectCreate, requester: Any
) -> ProjectRead:
    """FR-005 client-active lookup; server sets company_share/developer_share/status."""
    client = clients_repo.get_client_by_id(session, payload.client_id)
    if client is None:
        logger.info(
            "projects.create_project: inactive/missing client_id=%s",
            payload.client_id,
        )
        raise ClientNotActiveError()

    if payload.assigned_developer_id:
        _ensure_active_developer(session, payload.assigned_developer_id)

    project = projects_repo.create_project(
        session,
        name=payload.name,
        description=payload.description,
        client_id=payload.client_id,
        assigned_developer_id=payload.assigned_developer_id,
        total_amount=payload.total_amount,
        company_share=Decimal("30.00"),
        developer_share=Decimal("70.00"),
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="pending",
        is_active=True,
    )
    logger.info("projects.create_project: project_id=%s created", project.id)
    return ProjectRead.model_validate(project)


def list_projects(
    session: Session, *, requester: Any
) -> list[ProjectRead | DeveloperProjectView]:
    if requester.role == "developer":
        rows = projects_repo.list_projects_for_user(session, requester.id)
        return [
            _build_developer_project_view(session, p, requester.id)
            for p in rows
        ]
    rows = projects_repo.list_projects(session)
    return [ProjectRead.model_validate(p) for p in rows]


def get_project(
    session: Session, *, project_id: int, requester: Any
) -> ProjectRead | DeveloperProjectView:
    if requester.role == "developer":
        project = projects_repo.get_project_for_user(
            session, project_id, requester.id
        )
        if project is None:
            raise ProjectNotFoundError(project_id)
        return _build_developer_project_view(session, project, requester.id)
    project = projects_repo.get_project_by_id(session, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)
    return ProjectRead.model_validate(project)


def update_project(
    session: Session,
    *,
    project_id: int,
    patch: ProjectUpdate,
    requester: Any,
) -> ProjectRead:
    project = projects_repo.get_project_by_id(session, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    fields = patch.model_dump(exclude_unset=True)

    # Activation: pending → active gated on share sum == 70.00.
    if "status" in fields:
        if fields["status"] != "active" or project.status != "pending":
            raise IllegalStatusTransitionError()
        current = projects_repo.sum_active_module_shares(session, project_id)
        if current != _CAP:
            logger.info(
                "projects.activation_gate: project_id=%s current=%s required=%s",
                project_id,
                current,
                _CAP,
            )
            raise ActivationGateError(current=current)

        # Advance payment floor: at least 30% of the total must be paid.
        paid_total = payments_service.get_paid_total(session, project_id)
        required_advance = (project.total_amount * _ADVANCE_MIN_PCT).quantize(
            Decimal("0.01")
        )
        if paid_total < required_advance:
            logger.info(
                "projects.activation_gate: project_id=%s paid=%s required_advance=%s",
                project_id,
                paid_total,
                required_advance,
            )
            raise AdvancePaymentRequiredError(
                paid=paid_total, required=required_advance
            )

    if fields.get("assigned_developer_id"):
        _ensure_active_developer(session, fields["assigned_developer_id"])

    # Date-range merge check: validate the post-merge pair, not just the patch.
    new_start: Date = fields.get("start_date", project.start_date)
    new_end: Date = fields.get("end_date", project.end_date)
    if new_end < new_start:
        raise DateRangeError()

    project = projects_repo.update_project(session, project, **fields)
    logger.info(
        "projects.update_project: project_id=%s changed=%s",
        project_id,
        list(fields.keys()),
    )
    return ProjectRead.model_validate(project)


def delete_project(session: Session, *, project_id: int) -> None:
    project = projects_repo.get_project_by_id(session, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)
    projects_repo.soft_delete_project(session, project)
    logger.info("projects.delete_project: project_id=%s soft-deleted", project_id)


# ---------- Aggregate progress ----------


def compute_progress(
    session: Session, *, project_id: int, requester: Any
) -> ProjectProgressResponse | DeveloperProgressResponse:
    if requester.role == "developer":
        project = projects_repo.get_project_for_user(
            session, project_id, requester.id
        )
    else:
        project = projects_repo.get_project_by_id(session, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    modules = projects_repo.list_active_modules(session, project_id)
    # FR-022: share-weighted average of module progress. Each module contributes
    # progress × share_percentage, normalised by the total active share, so a
    # larger module moves the needle more than a small one. Falls back to 0 when
    # there are no modules (or, defensively, zero total share).
    total_share = sum((m.share_percentage for m in modules), Decimal("0"))
    if not modules or total_share == Decimal("0"):
        progress = 0.0
    else:
        weighted = sum(
            (m.progress * m.share_percentage for m in modules), Decimal("0")
        )
        progress = round(float(weighted / total_share), 1)

    if requester.role == "developer":
        own_modules = [
            m
            for m in modules
            if m.assigned_developer_id == requester.id
        ]
        return DeveloperProgressResponse(
            project_id=project.id,
            progress=progress,
            modules=[
                DeveloperProgressModule(
                    id=m.id,
                    name=m.name,
                    progress=m.progress,
                    status=m.status,
                    module_allocation=(
                        project.total_amount * m.share_percentage / Decimal("100")
                    ).quantize(Decimal("0.01")),
                    earned_amount=(
                        project.total_amount
                        * m.share_percentage
                        / Decimal("100")
                        * Decimal(m.progress)
                        / Decimal("100")
                    ).quantize(Decimal("0.01")),
                )
                for m in own_modules
            ],
        )

    return ProjectProgressResponse(
        project_id=project.id,
        progress=progress,
        modules=[
            ModuleProgressSummary.model_validate(m) for m in modules
        ],
    )


# ---------- Module operations ----------


def create_module(
    session: Session,
    *,
    project_id: int,
    payload: ModuleCreate,
    requester: Any,
) -> ModuleRead:
    project = projects_repo.get_project_by_id(session, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)
    if project.status == "completed":
        raise CompletedProjectFrozenError()

    _ensure_active_developer(session, payload.assigned_developer_id)

    current = projects_repo.sum_active_module_shares(session, project_id)
    if current + payload.share_percentage > _CAP:
        logger.info(
            "projects.cap_guard: project_id=%s current=%s requested=%s",
            project_id,
            current,
            payload.share_percentage,
        )
        raise ShareCapExceededError(
            current=current, requested=payload.share_percentage
        )

    module = projects_repo.create_module(
        session,
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        assigned_developer_id=payload.assigned_developer_id,
        share_percentage=payload.share_percentage,
        progress=0,
        status="pending",
        is_active=True,
    )
    logger.info(
        "projects.create_module: module_id=%s project_id=%s",
        module.id,
        project_id,
    )
    _notify_assignment(
        session,
        developer_id=payload.assigned_developer_id,
        module_name=payload.name,
        project_name=project.name,
    )
    return ModuleRead.model_validate(module)


def update_module(
    session: Session,
    *,
    module_id: int,
    patch: ModuleUpdate,
    requester: Any,
) -> ModuleRead:
    module = projects_repo.get_module_by_id(session, module_id)
    if module is None:
        raise ModuleNotFoundError(module_id)
    project = projects_repo.get_project_by_id(session, module.project_id)
    if project is None or project.status == "completed":
        raise CompletedProjectFrozenError()

    fields = patch.model_dump(exclude_unset=True)

    if "assigned_developer_id" in fields:
        _ensure_active_developer(session, fields["assigned_developer_id"])

    if "share_percentage" in fields:
        current = projects_repo.sum_active_module_shares(
            session, module.project_id, exclude_module_id=module_id
        )
        if current + fields["share_percentage"] > _CAP:
            raise ShareCapExceededError(
                current=current, requested=fields["share_percentage"]
            )

    old_developer_id = module.assigned_developer_id
    module = projects_repo.update_module(session, module, **fields)
    _maybe_autocomplete_project(session, project)
    logger.info(
        "projects.update_module: module_id=%s changed=%s",
        module_id,
        list(fields.keys()),
    )
    if "assigned_developer_id" in fields:
        new_dev = fields["assigned_developer_id"]
        if new_dev != old_developer_id:
            _notify_assignment(
                session,
                developer_id=new_dev,
                module_name=module.name,
                project_name=project.name,
            )
    return ModuleRead.model_validate(module)


def delete_module(session: Session, *, module_id: int) -> None:
    module = projects_repo.get_module_by_id(session, module_id)
    if module is None:
        raise ModuleNotFoundError(module_id)
    project = projects_repo.get_project_by_id(session, module.project_id)
    if project is None or project.status == "completed":
        raise CompletedProjectFrozenError()
    projects_repo.soft_delete_module(session, module)
    _maybe_autocomplete_project(session, project)
    logger.info("projects.delete_module: module_id=%s soft-deleted", module_id)


def update_module_progress(
    session: Session,
    *,
    module_id: int,
    patch: ModuleProgressUpdate,
    requester: Any,
) -> ModuleRead:
    module = projects_repo.get_module_by_id(session, module_id)
    if module is None:
        raise ModuleNotFoundError(module_id)
    project = projects_repo.get_project_by_id(session, module.project_id)
    if project is None or project.status != "active":
        raise ProgressNotPermittedError()

    if requester.role == "developer" and requester.id != module.assigned_developer_id:
        logger.info(
            "projects.update_module_progress: developer_id=%s not assignee of module_id=%s",
            requester.id,
            module_id,
        )
        raise DeveloperNotAssignedError()

    derived_status = _derive_module_status(patch.progress)
    module = projects_repo.update_module(
        session,
        module,
        progress=patch.progress,
        status=derived_status,
    )
    _maybe_autocomplete_project(session, project)
    developer = users_repo.get_user_by_id(session, module.assigned_developer_id)
    developer_name = developer.name if developer else "Unknown"
    _notify_progress_update(
        session,
        module_name=module.name,
        project_name=project.name,
        developer_name=developer_name,
        progress=patch.progress,
    )
    logger.info(
        "projects.update_module_progress: module_id=%s progress=%s status=%s",
        module_id,
        patch.progress,
        derived_status,
    )
    return ModuleRead.model_validate(module)


__all__ = [
    "ProjectNotFoundError",
    "ModuleNotFoundError",
    "ClientNotActiveError",
    "DeveloperNotEligibleError",
    "ShareCapExceededError",
    "ActivationGateError",
    "IllegalStatusTransitionError",
    "CompletedProjectFrozenError",
    "ProgressNotPermittedError",
    "DeveloperNotAssignedError",
    "DateRangeError",
    "create_project",
    "list_projects",
    "get_project",
    "update_project",
    "delete_project",
    "compute_progress",
    "create_module",
    "update_module",
    "delete_module",
    "update_module_progress",
]
