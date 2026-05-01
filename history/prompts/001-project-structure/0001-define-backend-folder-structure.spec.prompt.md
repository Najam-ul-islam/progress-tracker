---
id: 0001
title: Define backend folder structure
stage: spec
date: 2026-05-01
surface: agent
model: claude-sonnet-4-6
feature: 001-project-structure
branch: 001-project-structure
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: ["spec", "scaffolding", "modular-monolith", "fastapi", "backend-structure"]
links:
  spec: specs/001-project-structure/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-project-structure/spec.md
  - specs/001-project-structure/checklists/requirements.md
tests:
  - none (spec stage)
---

## Prompt

the backend is in backend folder and uv project is generated already  /sp.specify

MODULE: Project Structure

PURPOSE:
Define the complete backend folder structure for a modular monolith SaaS system.

TECH STACK:
- FastAPI
- SQLModel
- PostgreSQL
- Alembic
- Uvicorn

ARCHITECTURE:
- Modular monolith
- Each module must be isolated

ROOT STRUCTURE:

app/
  core/
  db/
  shared/
  modules/
    auth/
    users/
    clients/
    projects/
    modules_tasks/
    developers/
    payments/
    reporting/
    notifications/

REQUIREMENTS:

Each module MUST contain:
- model.py
- schema.py
- service.py
- repository.py
- routes.py
- dependencies.py

GLOBAL REQUIREMENTS:
- central database config in db/
- shared utilities in shared/
- core configs in core/
- main.py as FastAPI entry point

OUTPUT:
- Complete folder structure
- Boilerplate files for each module
- Ready-to-run FastAPI project skeleton

CONSTRAINTS:
- No business logic yet
- No implementation logic
- Structure only

SUCCESS CRITERIA:
- Clean, consistent modular structure
- All modules follow identical pattern

## Response snapshot

Created branch `001-project-structure` and authored `specs/001-project-structure/spec.md` covering:
- Three prioritised user stories (engineer bootstrap P1, feature-author code placement P1, operator DB/settings configuration P2).
- 24 functional requirements (FR-001 … FR-024) covering top-level layout, core/db/shared, nine domain modules with identical six-file layer set, application wiring, Alembic environment, uv tooling, and structural constraints (no business logic, no cross-module imports).
- Edge cases including the `modules` package vs. `modules_tasks` domain naming collision and Windows path handling.
- Seven measurable success criteria (SC-001 … SC-007) covering bootstrap time, server startup, structural symmetry, contributor onboarding speed, registration data-drivenness, Alembic readiness, zero cross-module imports.
- Assumptions and Out-of-Scope sections.

Also created `specs/001-project-structure/checklists/requirements.md` with all quality items passing (1/1 validation iteration).

Spec is ready for `/sp.clarify` (optional) or `/sp.plan`. No `[NEEDS CLARIFICATION]` markers remain.

## Outcome

- ✅ Impact: Spec authored and validated for the foundational backend skeleton; unblocks `/sp.plan` for the modular-monolith scaffold.
- 🧪 Tests: none (spec stage; structural verification deferred to implementation phase).
- 📁 Files: 2 created (`spec.md`, `checklists/requirements.md`).
- 🔁 Next prompts: `/sp.plan` to design the implementation strategy and Alembic placement; optionally `/sp.clarify` if reviewer wants to challenge any assumption.
- 🧠 Reflection: The PowerShell `create-new-feature.ps1` script mis-parsed the long quoted feature description as positional arguments and exited before copying the spec template; the branch and spec directory were created, and the template copy + history dir were completed manually. Worth noting in case future `/sp.specify` invocations with multi-paragraph descriptions hit the same parsing edge.

## Evaluation notes (flywheel)

- Failure modes observed: `create-new-feature.ps1` argument-binding error on multi-line quoted feature description (script aborted post-branch-creation but pre-template-copy). Recovered by completing template copy and history-dir creation manually.
- Graders run and results (PASS/FAIL): requirements.md checklist — PASS (all items).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): when re-invoking the PS script for future features, pass the feature description as the first positional argument before any switches, or via stdin/file, to avoid parameter-binding ambiguity.
