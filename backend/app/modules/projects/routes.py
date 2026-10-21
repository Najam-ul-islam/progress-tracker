"""Projects module: HTTP routing only. Delegates to services.

The projects module owns two URL prefixes:

  - ``/projects``  — exported as ``router``        (mounted by ``MODULE_REGISTRY``)
  - ``/modules``   — exported as ``modules_router`` (mounted explicitly in
                     ``app.main`` since each ``MODULE_REGISTRY`` entry maps to
                     a single prefix).

No business logic. Endpoints translate service-level exceptions into the
canonical HTTP responses defined in
``specs/005-projects/contracts/openapi.yaml``.
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
from app.modules.projects import service as projects_service
from app.modules.projects.schema import (
    ModuleCreate,
    ModuleProgressUpdate,
    ModuleRead,
    ModuleUpdate,
    ProjectCreate,
    ProjectProgressResponse,
    ProjectRead,
    ProjectUpdate,
)


router = APIRouter(tags=["projects"])
modules_router = APIRouter(tags=["modules"])


_PROJECT_NOT_FOUND = "Project not found"
_MODULE_NOT_FOUND = "Module not found"
_FORBIDDEN = "Forbidden"


# ---------- /projects ----------


@router.post(
    "", response_model=ProjectRead, status_code=status.HTTP_201_CREATED
)
def create_project(
    payload: ProjectCreate,
    session: Session = Depends(get_session),
    requester: Any = Depends(require_any("admin", "manager")),
) -> ProjectRead:
    try:
        return projects_service.create_project(
            session, payload=payload, requester=requester
        )
    except projects_service.ClientNotActiveError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.get("", response_model=list[ProjectRead])
def list_projects(
    session: Session = Depends(get_session),
    requester: Any = Depends(get_current_user),
) -> list[ProjectRead]:
    return projects_service.list_projects(session, requester=requester)


@router.get("/{id}", response_model=ProjectRead)
def get_project(
    id: int,
    session: Session = Depends(get_session),
    requester: Any = Depends(get_current_user),
) -> ProjectRead:
    try:
        return projects_service.get_project(
            session, project_id=id, requester=requester
        )
    except projects_service.ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_PROJECT_NOT_FOUND
        )


@router.patch("/{id}", response_model=ProjectRead)
def update_project(
    id: int,
    patch: ProjectUpdate,
    session: Session = Depends(get_session),
    requester: Any = Depends(require_any("admin", "manager")),
) -> ProjectRead:
    try:
        return projects_service.update_project(
            session, project_id=id, patch=patch, requester=requester
        )
    except projects_service.ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_PROJECT_NOT_FOUND
        )
    except (
        projects_service.ActivationGateError,
        projects_service.IllegalStatusTransitionError,
        projects_service.DateRangeError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    id: int,
    session: Session = Depends(get_session),
    _: Any = Depends(require_admin),
) -> None:
    try:
        projects_service.delete_project(session, project_id=id)
    except projects_service.ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_PROJECT_NOT_FOUND
        )


@router.get("/{id}/progress", response_model=ProjectProgressResponse)
def get_project_progress(
    id: int,
    session: Session = Depends(get_session),
    requester: Any = Depends(get_current_user),
) -> ProjectProgressResponse:
    try:
        return projects_service.compute_progress(
            session, project_id=id, requester=requester
        )
    except projects_service.ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_PROJECT_NOT_FOUND
        )


@router.post(
    "/{id}/modules",
    response_model=ModuleRead,
    status_code=status.HTTP_201_CREATED,
)
def create_module(
    id: int,
    payload: ModuleCreate,
    session: Session = Depends(get_session),
    requester: Any = Depends(require_any("admin", "manager")),
) -> ModuleRead:
    try:
        return projects_service.create_module(
            session,
            project_id=id,
            payload=payload,
            requester=requester,
        )
    except projects_service.ProjectNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_PROJECT_NOT_FOUND
        )
    except (
        projects_service.DeveloperNotEligibleError,
        projects_service.ShareCapExceededError,
        projects_service.CompletedProjectFrozenError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


# ---------- /modules ----------


@modules_router.patch("/{id}", response_model=ModuleRead)
def update_module(
    id: int,
    patch: ModuleUpdate,
    session: Session = Depends(get_session),
    requester: Any = Depends(require_any("admin", "manager")),
) -> ModuleRead:
    try:
        return projects_service.update_module(
            session, module_id=id, patch=patch, requester=requester
        )
    except projects_service.ModuleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_MODULE_NOT_FOUND
        )
    except (
        projects_service.DeveloperNotEligibleError,
        projects_service.ShareCapExceededError,
        projects_service.CompletedProjectFrozenError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@modules_router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    id: int,
    session: Session = Depends(get_session),
    _: Any = Depends(require_admin),
) -> None:
    try:
        projects_service.delete_module(session, module_id=id)
    except projects_service.ModuleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_MODULE_NOT_FOUND
        )
    except projects_service.CompletedProjectFrozenError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@modules_router.patch("/{id}/progress", response_model=ModuleRead)
def update_module_progress(
    id: int,
    patch: ModuleProgressUpdate,
    session: Session = Depends(get_session),
    requester: Any = Depends(get_current_user),
) -> ModuleRead:
    try:
        return projects_service.update_module_progress(
            session, module_id=id, patch=patch, requester=requester
        )
    except projects_service.ModuleNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=_MODULE_NOT_FOUND
        )
    except projects_service.DeveloperNotAssignedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_FORBIDDEN
        )
    except projects_service.ProgressNotPermittedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
