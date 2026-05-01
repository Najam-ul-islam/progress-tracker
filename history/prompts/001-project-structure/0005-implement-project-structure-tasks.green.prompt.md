---
id: 0005
title: Implement project structure tasks
stage: green
date: 2026-05-01
surface: agent
model: claude-sonnet-4-6
feature: 001-project-structure
branch: 001-project-structure
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: [implement, scaffolding, modular-monolith, uv, alembic]
links:
  spec: specs/001-project-structure/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - backend/.env.example
  - backend/app/__init__.py
  - backend/app/core/__init__.py
  - backend/app/core/config.py
  - backend/app/core/security.py
  - backend/app/db/__init__.py
  - backend/app/db/base.py
  - backend/app/db/session.py
  - backend/app/shared/__init__.py
  - backend/app/shared/utils.py
  - backend/app/shared/constants.py
  - backend/app/shared/decimal_utils.py
  - backend/app/modules/__init__.py
  - backend/app/modules/README.md
  - backend/app/modules/auth/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/users/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/clients/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/projects/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/modules_tasks/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/developers/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/payments/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/reporting/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/modules/notifications/{__init__,model,schema,service,repository,routes,dependencies}.py
  - backend/app/main.py
  - backend/alembic.ini
  - backend/alembic/env.py
  - backend/alembic/script.py.mako
  - backend/alembic/README
  - backend/README.md
  - specs/001-project-structure/tasks.md
tests:
  - smoke: uv run uvicorn app.main:app --port 8765 → /docs HTTP 200, /openapi.json HTTP 200
  - alembic: uv run alembic current → connects, "Will assume transactional DDL"
  - cross-module-import audit: zero matches for `from app.modules.<a>` inside another module
  - directory-symmetry: 9 modules × identical 7-file set
---

## Prompt

Execute tasks.md for feature 001-project-structure. STRICT + SAFE + UV-ONLY:
- Use `uv add` only for missing deps; `uv run` for all commands; never pip; never manual venv.
- Create only missing files/folders; never overwrite existing.
- Verify the app starts after major steps via `uv run uvicorn app.main:app`.
- Working directory for backend ops is `backend/`.

## Response snapshot

Executed all 37 tasks (T001–T037) across 6 phases without overwriting any existing file and without invoking pip or creating a manual venv.

- **Phase 1 (T001–T003)**: `uv sync` clean; pyproject.toml audit confirmed zero missing deps; created `backend/.env.example` (existing `.env` untouched).
- **Phase 2 (T004–T009)**: Created `app/`, `app/core/`, `app/db/`, `app/shared/`, `app/modules/` with layer-marker `__init__.py` docstrings. Existing `backend/main.py` (Hello World) preserved.
- **Phase 3 (T010–T019)**: Scaffolded all nine domain modules with the seven-file layer set. `app/main.py` wires routers via data-driven `MODULE_REGISTRY` (`modules_tasks` → `/modules-tasks`).
- **Phase 4 (T020–T022)**: Verified directory symmetry; layer-marker docstrings already in place from scaffolding; created `app/modules/README.md` pointing to `contracts/module-layer-contract.md`.
- **Phase 5 (T023–T032)**: Created `core/config.py` (Pydantic-Settings + `@lru_cache get_settings`), `core/security.py` (NotImplementedError stubs), `db/base.py` (SQLModel metadata), `db/session.py` (lazy engine + session generator), `shared/utils.py`, `shared/constants.py` (`COMPANY_SHARE=0.30`, `DEVELOPER_SHARE=0.70`), `shared/decimal_utils.py` (sole legal home for money math). `uv run alembic init -t generic alembic`; edited `alembic/env.py` to load `.env` via `python-dotenv`, set `target_metadata = SQLModel.metadata`, override `sqlalchemy.url` from `DATABASE_URL` env. `alembic.ini` `script_location` left at default `%(here)s/alembic`.
- **Phase 6 (T033–T037)**: Smoke-ran `uvicorn app.main:app` on port 8765 — `/docs` and `/openapi.json` both 200. Cross-module-import audit returned zero matches. Directory-symmetry confirmed (9 × 7). `backend/README.md` populated with quickstart pointer.

Validation outcome: app boots, alembic connects to Neon Postgres, contract enforced. All 37 tasks marked `[X]` in `specs/001-project-structure/tasks.md`.

## Outcome

- ✅ Impact: Backend modular-monolith skeleton complete; nine domains wired; Alembic ready for first migration; foundation passes constitutional checks (uv-only, decimal helpers centralised, layer separation, no cross-module imports).
- 🧪 Tests: smoke (HTTP 200 on `/docs`), alembic connection, import audit, directory symmetry — all pass.
- 📁 Files: 70+ files created across `backend/app/`, `backend/alembic/`; zero overwrites of pre-existing user code (existing `.env` and `backend/main.py` preserved).
- 🔁 Next prompts: `/sp.specify` for the auth feature (first domain to populate the `auth` module's six layer files); first Alembic migration after the auth User model lands.
- 🧠 Reflection: The "skip if exists" guard plus the data-driven MODULE_REGISTRY made adding/verifying nine modules a deterministic, repeatable operation; alembic's env.py needed to bypass full Settings (which requires JWT_SECRET_KEY) and read `DATABASE_URL` directly via `python-dotenv` so migrations work without forcing JWT secrets into the env at migration time.

## Evaluation notes (flywheel)

- Failure modes observed: initial `alembic env.py` instantiated full `Settings()` and crashed on missing `JWT_SECRET_KEY`; fixed by loading `DATABASE_URL` directly via `os.environ` after `load_dotenv()`.
- Graders run and results (PASS/FAIL): smoke=PASS, alembic=PASS, cross-module-import=PASS, directory-symmetry=PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): consider exposing a narrower `get_database_url()` factory in `app/core/config.py` so alembic can reuse a shared loader instead of re-implementing dotenv lookup.
