---
id: 0003
title: Generate skeleton task list
stage: tasks
date: 2026-05-01
surface: agent
model: claude-sonnet-4-6
feature: 001-project-structure
branch: 001-project-structure
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["tasks", "scaffolding", "modular-monolith", "incremental"]
links:
  spec: specs/001-project-structure/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-project-structure/tasks.md
tests:
  - none (no test tasks generated; spec did not request tests)
---

## Prompt

/sp.tasks

MODULE: Project Structure

OBJECTIVE: Transform the existing uv-based FastAPI project into a modular monolith architecture safely, without breaking existing functionality.

TASK GROUP 1: DEPENDENCY VALIDATION — verify required packages installed; install only missing.
TASK GROUP 2: ROOT STRUCTURE CREATION — create app/{core,db,shared,modules} only if missing.
TASK GROUP 3: SAFE FILE RELOCATION — only move main.py / db config if needed; keep app running after each move.
TASK GROUP 4: MODULE SCAFFOLDING — for {auth, users, clients, projects, modules_tasks, developers, payments, reporting, notifications}: create folder + 6 files (model.py, schema.py, service.py, repository.py, routes.py, dependencies.py) only if missing.
TASK GROUP 5: CORE LAYER COMPLETION — core/{config.py, security.py}; db/{session.py, base.py}; shared/{utils.py, constants.py}.
TASK GROUP 6: MAIN APPLICATION STANDARDIZATION — FastAPI instance + router registration; verify uvicorn app.main:app and /docs accessible.
TASK GROUP 7: DATABASE CONFIGURATION CHECK — SQLModel engine, env-based URL, session dependency.
TASK GROUP 8: ALEMBIC SAFE SETUP — initialize if missing; otherwise validate env.py and DB URL.
TASK GROUP 9: VALIDATION — server starts, /docs accessible, no import errors.

GLOBAL CONSTRAINTS: never overwrite existing working code; only create missing files/folders; keep changes incremental; verify after major steps.

NEXT STEP: proceed to /sp.implement.

## Response snapshot

Generated `specs/001-project-structure/tasks.md` with **37 atomic, dependency-ordered tasks** organized by user story per the SDD checklist format:

**Phase breakdown**:
- **Phase 1 — Setup** (T001–T003): `uv sync` audit, dependency presence check (no installs needed — verified during /sp.plan), `.env.example` creation.
- **Phase 2 — Foundational** (T004–T009): Create `app/`, `app/core/`, `app/db/`, `app/shared/`, `app/modules/` with `__init__.py` markers; preserve existing `backend/main.py` Hello-World.
- **Phase 3 — US1 (P1, MVP)** (T010–T019): Nine parallel module-scaffolding tasks (one per domain), then sequential `app/main.py` wiring with FastAPI instance + `MODULE_REGISTRY` + `register_modules()` loop.
- **Phase 4 — US2 (P1)** (T020–T022): Symmetry verification, layer-marker docstring backfill, modules `README.md`.
- **Phase 5 — US3 (P2)** (T023–T032): `core/config.py` (pydantic-settings), `core/security.py` (JWT placeholders), `db/base.py`, `db/session.py`, `shared/{utils.py, constants.py, decimal_utils.py}`, `alembic init` (or validation), `alembic/env.py` and `alembic.ini` wiring.
- **Phase 6 — Polish** (T033–T037): Server-startup check, cross-module-import audit (SC-007), directory-symmetry check (SC-003), end-to-end quickstart timing (SC-001), README pointer.

**Counts**:
- Total: 37 tasks.
- Per story: Setup 3, Foundational 6, US1 10, US2 3, US3 10, Polish 5.
- Parallel-marked [P]: 17 tasks across all phases.

**Story labels**: All US-phase tasks (T010–T032) carry `[US1]`, `[US2]`, or `[US3]`. Setup, Foundational, and Polish phases carry no story label per the format spec.

**Format validation**: Every task uses `- [ ] Tnnn [P?] [USx?] description with file path`; no task is missing checkbox, ID, or path.

**MVP scope**: Phases 1–3 (Setup → Foundational → US1) deliver the runnable skeleton with all nine empty routers wired. US2 and US3 are independently deliverable after the MVP.

**Parallel opportunities**: T010–T018 (nine module folders) all parallelizable since each writes to a different directory. T023/T024, T027/T028/T029, T033/T034/T035 also parallel.

Tasks are ready for `/sp.implement`.

## Outcome

- ✅ Impact: Concrete, executable, dependency-ordered task list ready for `/sp.implement`. Each task names exact file paths; LLM can complete each without further context.
- 🧪 Tests: none (spec did not request tests; only an import-smoke + `/docs` HTTP-200 check, which is captured as polish-phase task T033).
- 📁 Files: 1 created (tasks.md, 37 tasks).
- 🔁 Next prompts: `/sp.implement` to execute the task list. Optional: `/sp.analyze` to cross-check spec/plan/tasks consistency before implementation.
- 🧠 Reflection: Mapped the user's 9 task groups to the spec's 3 user stories. TG1/TG2/TG6 mostly map to Setup+Foundational+US1. TG4 is US1's bulk parallelizable work. TG5/TG7/TG8 are US3. TG3 (file relocation) reduced to a single preservation task (T009) because the existing `backend/main.py` is a Hello-World decoupled from any FastAPI runtime — nothing actually needs moving. TG9 is the polish phase.

## Evaluation notes (flywheel)

- Failure modes observed: none.
- Graders run and results (PASS/FAIL): format validation — PASS (all 37 tasks conform to `[ ] Tnnn [P?] [USx?] desc with path`). Coverage — PASS (every spec FR-001…FR-024 has at least one corresponding task; every SC-001…SC-007 has a polish-phase verification task).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): generate a static cross-check matrix (FR ↔ task ID) as a hidden appendix in tasks.md to make `/sp.analyze` faster. Defer until the matrix is requested.
