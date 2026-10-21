# Internal Contract: Access Control Matrix

**Feature**: `005-projects`
**Date**: 2026-05-04

This document is the canonical RBAC table for the projects module. Routes
consume `auth.dependencies` already established by feature 002; this matrix
tells reviewers and tests *what should happen* for each (endpoint × role)
cell.

## Notation

- ✅ — request is allowed; response is the documented 2xx.
- ✅ʳ — request is allowed only conditionally (per-row visibility / ownership
  check enforced inside the service layer; failure becomes 404 or 403 per
  the rule listed in Notes).
- 🚫 403 — request is rejected with `403 Forbidden`, generic body
  `{"detail":"Forbidden"}`, BEFORE the service layer runs.
- 🔒 401 — no/bad bearer token. Always returned **before** any role check.

All cells assume a valid bearer token has been presented; the 401 row is
implicit.

## Matrix

| Endpoint                              | Method | admin | manager | developer | Notes                                                                 |
| ------------------------------------- | ------ | ----- | ------- | --------- | --------------------------------------------------------------------- |
| `/projects`                           | POST   | ✅    | ✅      | 🚫 403    | FR-005 client lookup, FR-006 date range.                               |
| `/projects`                           | GET    | ✅    | ✅      | ✅ʳ       | Developer sees only projects they're assigned to (FR-008).             |
| `/projects/{id}`                      | GET    | ✅    | ✅      | ✅ʳ       | Developer not assigned to project → 404 (FR-008, hides existence).     |
| `/projects/{id}`                      | PATCH  | ✅    | ✅      | 🚫 403    | `status:"active"` runs activation gate (FR-013); `completed`/`pending` rejected (FR-014, FR-015). |
| `/projects/{id}`                      | DELETE | ✅¹   | 🚫 403  | 🚫 403    | ¹ Admin only. Soft delete; 204.                                        |
| `/projects/{id}/progress`             | GET    | ✅    | ✅      | ✅ʳ       | Same visibility filter as `GET /projects/{id}`.                        |
| `/projects/{id}/modules`              | POST   | ✅    | ✅      | 🚫 403    | FR-009 developer-eligibility, FR-010 share-cap, FR-016 not on completed. |
| `/modules/{id}`                       | PATCH  | ✅    | ✅      | 🚫 403    | FR-011 cap check excludes own share; FR-009 on developer change.       |
| `/modules/{id}`                       | DELETE | ✅¹   | 🚫 403  | 🚫 403    | ¹ Admin only. Frees share for re-use; FR-014 auto-complete check.      |
| `/modules/{id}/progress`              | PATCH  | ✅    | ✅      | ✅ʳ       | Developer must be `assigned_developer_id` (FR-019); FR-021 active-only. |

## Enforcement points

| Layer                    | Mechanism                                                                                                                                                                       | Files                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Authentication           | `Depends(get_current_user)` resolves the bearer token to a `User` row. Failures ⇒ 401 generic body.                                                                              | `app/modules/auth/dependencies.py` (feature 002).                    |
| Role gate                | `Depends(require_admin)` for both DELETEs; `Depends(require_any("admin","manager"))` for project create/update, module create/update; `Depends(get_current_user)` only for read paths and progress patch (the per-row check is in the service). | `app/modules/auth/dependencies.py` (feature 002).                    |
| Per-row visibility       | `projects.repository.list_projects_for_user` and `get_project_for_user` filter by developer assignment for the `developer` role.                                                | `app/modules/projects/repository.py` (this feature).                  |
| Ownership on progress    | `projects.service.update_module_progress` checks `module.assigned_developer_id == requester.id` for developers.                                                                  | `app/modules/projects/service.py` (this feature).                     |
| Soft-delete read         | All repository read paths filter `is_active = TRUE` on both `project` and `project_module`.                                                                                      | `app/modules/projects/repository.py`.                                 |
| Share-cap guard          | `projects.repository.sum_active_module_shares` invoked from `service.create_module` and `service.update_module` (FR-010, FR-011).                                                | `app/modules/projects/{repository,service}.py`.                       |
| Activation gate          | `projects.service.activate_project` reads the same sum and requires equality with 70.00 (FR-013).                                                                                | `app/modules/projects/service.py`.                                    |
| Auto-completion          | `projects.service._maybe_autocomplete_project` invoked from every write path that can change "all modules at 100" state (FR-014).                                                | `app/modules/projects/service.py`.                                    |
| Module boundary          | `audit_projects_imports.sh` fails the build if `projects/**.py` imports anything outside the FR-027 allow-list.                                                                  | `backend/scripts/audit_projects_imports.sh` (this feature).           |

## Ordering: 401 → 403 → 404 → 422 → 2xx

For each endpoint, conditions are evaluated in this fixed order. The first
matching condition wins; later conditions are not even computed.

1. **401** — token missing/bad/expired. Returned by `get_current_user`
   before any route code runs.
2. **403** — caller's role is not on the dependency-injected allow-list.
   Returned by `require_*` before any service code runs.
3. **404** — for callers past the role gate: lookup of `{id}` returned no
   row, or the row is soft-deleted, or (developer role) the row exists but
   the per-row visibility check excludes it. The body does not distinguish
   these cases (FR-026).
4. **422** — Pydantic validation failure (missing required field, closed-
   schema rejection, no-op patch, bad date range, share-cap exceeded,
   activation gate failure, illegal status transition, FK target missing,
   developer-not-eligible, completed-project-frozen, progress-on-non-active).
5. **2xx** — write/read succeeds; service returns the appropriate body
   (or 204 for DELETE).

There is no 409 in this feature: there is no uniqueness constraint to
collide on. Cap-overruns and activation-gate failures are 422
(unprocessable, not conflicting).

## Route-to-dependency wiring (sketch)

```python
# app/modules/projects/routes.py — pseudocode.

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.database import get_session
from app.modules.auth.dependencies import (
    get_current_user, require_admin, require_any,
)
from app.modules.projects import service as projects_service
from app.modules.projects.schema import (
    ProjectCreate, ProjectUpdate, ProjectRead,
    ModuleCreate, ModuleUpdate, ModuleRead,
    ModuleProgressUpdate, ProjectProgressResponse,
)


router = APIRouter(tags=["projects"])


@router.post("/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    session: Session = Depends(get_session),
    requester=Depends(require_any("admin", "manager")),
) -> ProjectRead:
    try:
        return projects_service.create_project(session, payload=payload, requester=requester)
    except projects_service.ClientNotActiveError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


@router.get("/projects", response_model=list[ProjectRead])
def list_projects(
    session: Session = Depends(get_session),
    requester=Depends(get_current_user),
) -> list[ProjectRead]:
    return projects_service.list_projects(session, requester=requester)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    session: Session = Depends(get_session),
    requester=Depends(get_current_user),
) -> ProjectRead:
    try:
        return projects_service.get_project(session, project_id=project_id, requester=requester)
    except projects_service.ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")


@router.patch("/projects/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    patch: ProjectUpdate,
    session: Session = Depends(get_session),
    requester=Depends(require_any("admin", "manager")),
) -> ProjectRead:
    try:
        return projects_service.update_project(session, project_id=project_id, patch=patch, requester=requester)
    except projects_service.ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    except (
        projects_service.ActivationGateError,
        projects_service.IllegalStatusTransitionError,
        projects_service.DateRangeError,
    ) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
) -> None:
    try:
        projects_service.delete_project(session, project_id=project_id)
    except projects_service.ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")


@router.get("/projects/{project_id}/progress", response_model=ProjectProgressResponse)
def get_project_progress(
    project_id: int,
    session: Session = Depends(get_session),
    requester=Depends(get_current_user),
) -> ProjectProgressResponse:
    try:
        return projects_service.compute_progress(session, project_id=project_id, requester=requester)
    except projects_service.ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")


@router.post("/projects/{project_id}/modules", response_model=ModuleRead, status_code=status.HTTP_201_CREATED)
def create_module(
    project_id: int,
    payload: ModuleCreate,
    session: Session = Depends(get_session),
    requester=Depends(require_any("admin", "manager")),
) -> ModuleRead:
    try:
        return projects_service.create_module(session, project_id=project_id, payload=payload, requester=requester)
    except projects_service.ProjectNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    except (
        projects_service.DeveloperNotEligibleError,
        projects_service.ShareCapExceededError,
        projects_service.CompletedProjectFrozenError,
    ) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


@router.patch("/modules/{module_id}", response_model=ModuleRead)
def update_module(
    module_id: int,
    patch: ModuleUpdate,
    session: Session = Depends(get_session),
    requester=Depends(require_any("admin", "manager")),
) -> ModuleRead:
    try:
        return projects_service.update_module(session, module_id=module_id, patch=patch, requester=requester)
    except projects_service.ModuleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    except (
        projects_service.DeveloperNotEligibleError,
        projects_service.ShareCapExceededError,
        projects_service.CompletedProjectFrozenError,
    ) as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: int,
    session: Session = Depends(get_session),
    _=Depends(require_admin),
) -> None:
    try:
        projects_service.delete_module(session, module_id=module_id)
    except projects_service.ModuleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    except projects_service.CompletedProjectFrozenError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


@router.patch("/modules/{module_id}/progress", response_model=ModuleRead)
def update_module_progress(
    module_id: int,
    patch: ModuleProgressUpdate,
    session: Session = Depends(get_session),
    requester=Depends(get_current_user),
) -> ModuleRead:
    try:
        return projects_service.update_module_progress(
            session, module_id=module_id, patch=patch, requester=requester
        )
    except projects_service.ModuleNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found")
    except projects_service.DeveloperNotAssignedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    except projects_service.ProgressNotPermittedError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
```

The router does no DB I/O, no business logic — only typed-exception →
HTTP-status translation. Mirrors the pattern from features 003 and 004.

## Service-layer exception → HTTP mapping

| Exception                            | Where raised                                                                                  | HTTP / detail                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ProjectNotFoundError`               | `get_project`, `update_project`, `delete_project`, `compute_progress`, `create_module`        | 404 `{"detail":"Project not found"}`                                                     |
| `ModuleNotFoundError`                | `update_module`, `delete_module`, `update_module_progress`                                    | 404 `{"detail":"Module not found"}`                                                      |
| `ClientNotActiveError`               | `create_project`                                                                              | 422 `{"detail":"client_id does not reference an active client"}`                          |
| `DeveloperNotEligibleError`          | `create_module`, `update_module`                                                              | 422 `{"detail":"assigned_developer_id must reference an active user with role=developer"}` |
| `ShareCapExceededError(current, requested)` | `create_module`, `update_module`                                                       | 422 `{"detail":"total module share would exceed 70.00 (current: <c>, requested: <r>)"}`   |
| `ActivationGateError(current)`       | `update_project` when `status="active"`                                                       | 422 `{"detail":"module shares must sum to exactly 70.00 to activate (current: <c>)"}`     |
| `IllegalStatusTransitionError`       | `update_project` when `status` is `pending` or `completed`                                    | 422 `{"detail":"illegal status transition"}`                                              |
| `CompletedProjectFrozenError`        | every module mutation when parent project is `completed`                                      | 422 `{"detail":"cannot mutate modules on a completed project"}`                           |
| `ProgressNotPermittedError`          | `update_module_progress` when parent project is not `active`                                  | 422 `{"detail":"cannot update progress on a non-active project"}`                         |
| `DeveloperNotAssignedError`          | `update_module_progress` when developer caller is not the module's assignee                   | 403 `{"detail":"Forbidden"}`                                                              |
| `DateRangeError`                     | `create_project`, `update_project` (post-merge `end_date < start_date`)                       | 422 `{"detail":"end_date must be on or after start_date"}`                                |

Pydantic validation failures (closed schema, type mismatches, no-op
patches) are handled by FastAPI before the route body runs — the route does
not need to catch them.
