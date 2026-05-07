"""Projects module: all database queries. No business logic, no HTTP concerns.

This is the only legal home for SQL against the `project` and `project_module`
tables (FR-001 / FR-028). Each helper is a single statement.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import func
from sqlmodel import Session, select

from app.modules.projects.model import Project, ProjectModule


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Project helpers ----------


def create_project(session: Session, **fields: Any) -> Project:
    project = Project(**fields)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def get_project_by_id(session: Session, project_id: int) -> Project | None:
    statement = (
        select(Project)
        .where(Project.id == project_id, Project.is_active == True)  # noqa: E712
        .limit(1)
    )
    return session.exec(statement).first()


def list_projects(session: Session) -> list[Project]:
    statement = (
        select(Project)
        .where(Project.is_active == True)  # noqa: E712
        .order_by(Project.id)
    )
    return list(session.exec(statement).all())


def list_projects_for_user(
    session: Session, user_id: int
) -> list[Project]:
    statement = (
        select(Project)
        .join(ProjectModule, ProjectModule.project_id == Project.id)
        .where(
            Project.is_active == True,  # noqa: E712
            ProjectModule.is_active == True,  # noqa: E712
            ProjectModule.assigned_developer_id == user_id,
        )
        .distinct()
        .order_by(Project.id)
    )
    return list(session.exec(statement).all())


def get_project_for_user(
    session: Session, project_id: int, user_id: int
) -> Project | None:
    statement = (
        select(Project)
        .join(ProjectModule, ProjectModule.project_id == Project.id)
        .where(
            Project.id == project_id,
            Project.is_active == True,  # noqa: E712
            ProjectModule.is_active == True,  # noqa: E712
            ProjectModule.assigned_developer_id == user_id,
        )
        .limit(1)
    )
    return session.exec(statement).first()


def update_project(
    session: Session, project: Project, **fields: Any
) -> Project:
    for key, value in fields.items():
        setattr(project, key, value)
    project.updated_at = _utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def soft_delete_project(session: Session, project: Project) -> None:
    project.is_active = False
    project.updated_at = _utcnow()
    session.add(project)
    session.commit()


# ---------- Module helpers ----------


def create_module(session: Session, **fields: Any) -> ProjectModule:
    module = ProjectModule(**fields)
    session.add(module)
    session.commit()
    session.refresh(module)
    return module


def get_module_by_id(
    session: Session, module_id: int
) -> ProjectModule | None:
    statement = (
        select(ProjectModule)
        .where(
            ProjectModule.id == module_id,
            ProjectModule.is_active == True,  # noqa: E712
        )
        .limit(1)
    )
    return session.exec(statement).first()


def list_active_modules(
    session: Session, project_id: int
) -> list[ProjectModule]:
    statement = (
        select(ProjectModule)
        .where(
            ProjectModule.project_id == project_id,
            ProjectModule.is_active == True,  # noqa: E712
        )
        .order_by(ProjectModule.id)
    )
    return list(session.exec(statement).all())


def update_module(
    session: Session, module: ProjectModule, **fields: Any
) -> ProjectModule:
    for key, value in fields.items():
        setattr(module, key, value)
    now = _utcnow()
    module.updated_at = now
    session.add(module)
    # Bump parent project's updated_at too (FR-017).
    parent = session.get(Project, module.project_id)
    if parent is not None:
        parent.updated_at = now
        session.add(parent)
    session.commit()
    session.refresh(module)
    return module


def soft_delete_module(
    session: Session, module: ProjectModule
) -> None:
    now = _utcnow()
    module.is_active = False
    module.updated_at = now
    session.add(module)
    parent = session.get(Project, module.project_id)
    if parent is not None:
        parent.updated_at = now
        session.add(parent)
    session.commit()


def sum_active_module_shares(
    session: Session,
    project_id: int,
    *,
    exclude_module_id: int | None = None,
) -> Decimal:
    statement = select(func.coalesce(func.sum(ProjectModule.share_percentage), 0)).where(
        ProjectModule.project_id == project_id,
        ProjectModule.is_active == True,  # noqa: E712
    )
    if exclude_module_id is not None:
        statement = statement.where(ProjectModule.id != exclude_module_id)
    result = session.exec(statement).one()
    if isinstance(result, tuple):
        result = result[0]
    return Decimal(str(result))
