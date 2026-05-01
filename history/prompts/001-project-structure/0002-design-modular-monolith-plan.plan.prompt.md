---
id: 0002
title: Design modular monolith plan
stage: plan
date: 2026-05-01
surface: agent
model: claude-sonnet-4-6
feature: 001-project-structure
branch: 001-project-structure
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["plan", "modular-monolith", "fastapi", "alembic", "uv", "skeleton"]
links:
  spec: specs/001-project-structure/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-project-structure/plan.md
  - specs/001-project-structure/research.md
  - specs/001-project-structure/data-model.md
  - specs/001-project-structure/contracts/module-layer-contract.md
  - specs/001-project-structure/quickstart.md
  - CLAUDE.md
tests:
  - none (plan stage)
---

## Prompt

/sp.plan

MODULE: Project Structure

OBJECTIVE:
Organize and standardize the backend into a modular monolith structure using the existing uv-based project. Do NOT reinitialize the project. Only extend, structure, and validate.

PHASE 1: PROJECT VALIDATION — verify uv project setup; install only missing deps from {fastapi, uvicorn, sqlmodel, alembic, python-dotenv, psycopg2-binary OR asyncpg}; optional passlib[bcrypt], python-jose[cryptography].

PHASE 2: STANDARDIZE ROOT STRUCTURE — app/{core,db,shared,modules,main.py}; do not delete existing code; only reorganize.

PHASE 3: MODULE SCAFFOLDING — for each module {auth, users, clients, projects, modules_tasks, developers, payments, reporting, notifications} create folder + 6 files {model.py, schema.py, service.py, repository.py, routes.py, dependencies.py} only if missing; do not overwrite.

PHASE 4: CORE SYSTEM SETUP — core/{config.py, security.py}; db/{session.py, base.py}; shared/{utils.py, constants.py}.

PHASE 5: APPLICATION ENTRYPOINT — validate main.py with FastAPI instance + router registration.

PHASE 6: DATABASE CONFIGURATION CHECK — SQLModel engine; session dependency; env-based PG connection string.

PHASE 7: ALEMBIC VALIDATION — initialize if missing; otherwise validate env.py and connection.

CONSTRAINTS: do not reinitialize uv project; do not reinstall existing deps; do not overwrite; only extend; keep backward compatibility.

SUCCESS CRITERIA: existing project remains functional; modular structure established; all modules scaffolded; deps complete; FastAPI runs; Alembic ready.

NEXT STEP: proceed to /sp.tasks.

## Response snapshot

Authored five planning artifacts under `specs/001-project-structure/`:

1. **plan.md** — Technical Context (Python 3.13+, FastAPI, SQLModel, Alembic, PostgreSQL); Constitution Check (PASS with two documented deferrals: Uvicorn worker tuning, JWT/RBAC — both out of scope per spec); Project Structure tree showing `backend/app/{core,db,shared,modules}/` plus `backend/alembic/`; Complexity Tracking justifying three deviations (per-module `dependencies.py`, preserving existing `backend/main.py`, introducing `shared/decimal_utils.py` early). Includes ADR suggestion for the modular-monolith skeleton decision.
2. **research.md** — Eight Decision/Rationale/Alternatives entries: PostgreSQL driver (sync psycopg2-binary default), Alembic at `backend/alembic/`, slugify rule `_` → `-` for `modules_tasks`, per-module `dependencies.py` justified, pydantic-settings + `@lru_cache` for settings, preserve existing `main.py`, `.env.example` template strategy, data-driven `MODULE_REGISTRY`.
3. **data-model.md** — No data entities (structural phase). Documents structural entities (5 top-level packages + 9 modules + registry + Alembic env), allowed-import dependency graph, forbidden cross-module edges, and the metadata-aggregation contract for future `model.py` files.
4. **contracts/module-layer-contract.md** — Authoritative per-layer ownership rules for the seven per-module files; phase-1 minimal-body table (each layer file has only a docstring; `routes.py` additionally exposes `router = APIRouter(...)`); module registry contract showing the 9-entry tuple and registration loop; forbidden cross-module imports rule.
5. **quickstart.md** — 7-step walkthrough (clone → `uv sync` → `.env.example` copy → `uvicorn` → `/docs` 200 → structure inspection → `alembic current`). Troubleshooting table.

Then ran `update-agent-context.ps1 -AgentType claude` which augmented `CLAUDE.md` with the detected language, framework, and database (Python 3.13+, FastAPI/SQLModel/Alembic stack, PostgreSQL).

**Constitution Check verdict**: PASS pre- and post-Phase-1.

**Architectural decision flagged**: Modular monolith with per-module 6-file layer contract, central Alembic env, data-driven router registry, and shared decimal utilities as the sole financial-helper home. Suggested running `/sp.adr modular-monolith-skeleton` to record reasoning. Awaiting user consent — no ADR auto-created.

Plan is ready for `/sp.tasks`.

## Outcome

- ✅ Impact: Implementation strategy locked in; all 8 research questions resolved; layer contract documented; Alembic placement chosen; module registry mechanism specified. Unblocks `/sp.tasks`.
- 🧪 Tests: none (plan stage; verification deferred to implement phase via quickstart.md walkthrough).
- 📁 Files: 5 created (plan.md, research.md, data-model.md, contracts/module-layer-contract.md, quickstart.md); 1 updated (CLAUDE.md via update-agent-context script).
- 🔁 Next prompts: `/sp.tasks` to break the plan into atomic, dependency-ordered tasks. Optional: `/sp.adr modular-monolith-skeleton` to record the architectural decision.
- 🧠 Reflection: All required deps were already in `pyproject.toml`, so phase-1 of the plan reduced to a dep audit (zero `uv add` invocations needed). The constitution placeholder file (`.specify/memory/constitution.md`) is unfilled — the active constitution is the in-conversation `/sp.constitution v1.0` directive; documented this explicitly in the plan's Constitution Check.

## Evaluation notes (flywheel)

- Failure modes observed: none in this stage. (Earlier `create-new-feature.ps1` failure noted in PHR 0001 did not recur.)
- Graders run and results (PASS/FAIL): Constitution Check — PASS pre- and post-Phase-1.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): consider auto-running `update-agent-context.ps1` from within the `/sp.plan` skill rather than as a manual step, to avoid skipping it under time pressure.
