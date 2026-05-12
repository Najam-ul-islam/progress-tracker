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
from app.modules.projects import repository as projects_repo
from app.modules.projects.schema import (
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


def _ensure_active_developer(session: Session, user_id: int) -> None:
    user = users_repo.get_user_by_id(session, user_id)
    if user is None or user.role != "developer" or not user.is_active:
        raise DeveloperNotEligibleError()


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

    project = projects_repo.create_project(
        session,
        name=payload.name,
        description=payload.description,
        client_id=payload.client_id,
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
) -> list[ProjectRead]:
    if requester.role == "developer":
        rows = projects_repo.list_projects_for_user(session, requester.id)
    else:
        rows = projects_repo.list_projects(session)
    return [ProjectRead.model_validate(p) for p in rows]


def get_project(
    session: Session, *, project_id: int, requester: Any
) -> ProjectRead:
    if requester.role == "developer":
        project = projects_repo.get_project_for_user(
            session, project_id, requester.id
        )
    else:
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
) -> ProjectProgressResponse:
    if requester.role == "developer":
        project = projects_repo.get_project_for_user(
            session, project_id, requester.id
        )
    else:
        project = projects_repo.get_project_by_id(session, project_id)
    if project is None:
        raise ProjectNotFoundError(project_id)

    modules = projects_repo.list_active_modules(session, project_id)
    if not modules:
        progress = 0.0
    else:
        progress = round(
            sum(m.progress for m in modules) / len(modules), 1
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

    module = projects_repo.update_module(session, module, **fields)
    _maybe_autocomplete_project(session, project)
    logger.info(
        "projects.update_module: module_id=%s changed=%s",
        module_id,
        list(fields.keys()),
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
