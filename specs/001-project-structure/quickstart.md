# Quickstart: Backend Modular Monolith Project Structure

**Feature**: 001-project-structure
**Audience**: New backend contributors
**Goal**: Clone → run → see `/docs` in under 5 minutes (per spec SC-001).

---

## Prerequisites

- Git
- Python 3.13+ (`.python-version` pins the exact patch)
- `uv` (https://docs.astral.sh/uv/) — package manager and runner
- PostgreSQL 15+ (only required if you intend to apply migrations; the FastAPI server itself starts without a live DB connection)

## Step 1 — Clone and enter the backend

```bash
git clone <repo-url>
cd <repo-root>/backend
```

## Step 2 — Install dependencies

```bash
uv sync
```

This reads `pyproject.toml` and `uv.lock` and creates `.venv/`. **No new dependencies are added by this feature — every required package is already pinned.** Sync is idempotent; re-running is safe.

## Step 3 — Configure environment

```bash
cp .env.example .env
# Edit .env to set DATABASE_URL, JWT_SECRET_KEY, etc.
```

`.env` is git-ignored. The example file lists every variable the app reads with safe placeholder values.

For the **structural skeleton** (this feature only), the app starts even with a placeholder `DATABASE_URL` — no DB connection is attempted at startup.

## Step 4 — Start the server

```bash
uv run uvicorn app.main:app --reload
```

Expected output (within ~3 s):

```text
INFO:     Will watch for changes in these directories: ['.../backend']
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## Step 5 — Verify

Open a browser to:

- **http://127.0.0.1:8000/docs** — Swagger UI; should render with no domain endpoints listed (the skeleton has none yet).
- **http://127.0.0.1:8000/openapi.json** — OpenAPI document; should contain the empty router includes for all nine modules.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/docs
# → 200
```

## Step 6 — Inspect the structure

```bash
ls app/
# core/  db/  shared/  modules/  main.py  __init__.py

ls app/modules/
# auth/  users/  clients/  projects/  modules_tasks/  developers/  payments/  reporting/  notifications/

ls app/modules/auth/
# __init__.py  model.py  schema.py  service.py  repository.py  routes.py  dependencies.py
```

Pick any other module and confirm the file list is **identical** (per FR-012):

```bash
diff <(ls app/modules/auth/) <(ls app/modules/payments/)
# → no output (files match)
```

## Step 7 — Verify Alembic

```bash
uv run alembic current
# → empty output (no revisions yet) — this is correct for the skeleton phase
```

If this errors with a connection refused, ensure your `DATABASE_URL` in `.env` points to a running PostgreSQL instance, OR comment out `DATABASE_URL` to skip migration validation.

---

## Done

You now have a runnable, navigable, modular backend skeleton. Total time should be **under 5 minutes** end-to-end (per SC-001).

## Next Steps

- The skeleton has **no business logic, no models, and no endpoints**. To add your first feature:
  1. Open `/sp.specify` with your feature description.
  2. Place tables in `app/modules/<domain>/model.py`.
  3. Place schemas in `app/modules/<domain>/schema.py`.
  4. Place business logic in `app/modules/<domain>/service.py`.
  5. Place queries in `app/modules/<domain>/repository.py`.
  6. Place endpoints in `app/modules/<domain>/routes.py` (the `router` is already declared and registered).
- Refer to `specs/001-project-structure/contracts/module-layer-contract.md` for the layer-by-layer ownership rules.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'app'` | Started uvicorn from the wrong directory | Run from `backend/` |
| `pydantic_settings ValidationError` | Missing required env var | Copy `.env.example` → `.env` and fill placeholders |
| `alembic.ini not found` | Wrong CWD | Run alembic from `backend/` (it's at `backend/alembic.ini`) |
| Port 8000 already in use | Another server bound the port | Pass `--port 8001` to uvicorn |
| Server boots but `/docs` 404s | Custom `docs_url=None` set | Default is `/docs`; check `app/main.py` `FastAPI(...)` args |
