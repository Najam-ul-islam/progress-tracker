---
id: 0002
title: Clients management plan
stage: plan
date: 2026-05-03
surface: agent
model: claude-sonnet-4-6
feature: 004-clients-management
branch: 003-users-management
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["clients", "rbac", "soft-delete", "uniqueness", "partial-index", "phone-validation", "plan"]
links:
  spec: specs/004-clients-management/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/004-clients-management/plan.md
  - specs/004-clients-management/research.md
  - specs/004-clients-management/data-model.md
  - specs/004-clients-management/contracts/openapi.yaml
  - specs/004-clients-management/contracts/access-control-matrix.md
  - specs/004-clients-management/quickstart.md
  - specs/004-clients-management/checklists/requirements.md
tests:
  - n/a (plan stage; tests authored in /sp.tasks → /sp.implement)
---

## Prompt

`/sp.plan` for MODULE: Clients. OBJECTIVE: implement clients module for
managing client data with RBAC, integrated into the uv-based modular
system. 8 phases: Dependency Check, Model, Schemas, Repository, Service,
Routes, Integration (router register at /clients), Validation
(`uv run uvicorn app.main:app --reload` + `/docs`). Constraints: no business
logic in routes, RBAC via auth, modular structure only.

## Response snapshot

Authored 7 plan artefacts under `specs/004-clients-management/`:

- **`plan.md`** — top-level plan: summary, technical context, constitution
  check (template constitution → default policies + cross-feature
  continuity), project structure, phase-0/1 outputs table, ADR
  suggestions, complexity tracking (none).
- **`research.md`** (R1–R8) — narrowly-scoped technical decisions:
  - **R1** Partial unique indexes on `(email)` and `(phone)` filtered by
    `is_active = TRUE`. Both Postgres and SQLite support this; the
    alembic revision passes both `postgresql_where=` and `sqlite_where=`
    so test/prod parity holds.
  - **R2** Phone validation by regex
    `^\+\d{1,3}[\d\s\-\(\)]{6,18}\d$` — no `phonenumbers` dependency.
    Trade-off recorded; ADR candidate flagged.
  - **R3** Schemas: `ClientCreate`, `ClientUpdate` (with empty-patch
    `model_validator`), `ClientRead`, `ClientListResponse`. Role
    `Literal` imported from `auth.schema` (closed enum, not business
    logic).
  - **R4** Repository: 6 narrow helpers (`create_client`,
    `get_client_by_id`, `list_clients`, `find_active_client_by_email`,
    `find_active_client_by_phone`, `update_client`, `soft_delete_client`).
    Repository converts `IntegrityError` → `DuplicateClientError` so the
    service emits the same 409 envelope whether duplicate caught
    proactively or by the index.
  - **R5** Service: 5 callables, typed exceptions
    (`ClientNotFoundError`, `DuplicateClientError(field=...)`).
  - **R6** No new test fixtures — feature 003's
    `seed_admin/manager/developer + auth_header` cover the full RBAC
    matrix.
  - **R7** New audit `audit_clients_imports.sh` enforces FR-020/FR-021.
    Allows `auth.dependencies` and `auth.schema` (role `Literal`); blocks
    `auth.service`, `auth.repository`, `users.*`, `projects.*`,
    `payments.*`.
  - **R8** Migration `20260504_create_client_table.py` — single revision,
    creates table + both partial indexes, no data backfill (new table).
- **`data-model.md`** — column table (10 columns), state diagram
  (active → updated → soft-deleted, no reactivation in this feature), FR
  → layer mapping, full Pydantic v2 schemas, full alembic migration
  outline, referential integrity outlook (`projects.client_id` FK target),
  storage envelope estimate.
- **`contracts/openapi.yaml`** — 5 endpoints, full request/response
  schemas, response examples for 401/403/404/409/422 plus 204 on DELETE,
  phone `pattern` exposed in Swagger.
- **`contracts/access-control-matrix.md`** — RBAC table, enforcement
  points, ordering 401→403→404→422→409→2xx, full `routes.py` pseudocode,
  exception → HTTP table.
- **`quickstart.md`** — 7-step manual walk: sync deps, run pytest, start
  uvicorn, seed users via `/auth/register`, walk all four user stories
  via curl (including duplicate-after-soft-delete re-use), run all four
  audit scripts, sanity-check `/docs`.
- **`checklists/requirements.md`** — spec-quality gate, all green; notes
  call out the three opinionated departures (409 vs 400, soft-delete
  required, manager-can-update).

Three ADR candidates flagged (significance test passes for all three):

- `clients-soft-delete-strategy`
- `unique-partial-index-among-active-rows`
- `phone-validation-regex-vs-library`

Per the project's policy, none auto-created — surfaced as suggestions only.

## Outcome

- ✅ Impact: feature 004 plan complete; ready for `/sp.tasks`. Architecture
  reuses feature 003 patterns (six-file modular layout, app-layer
  `updated_at`, soft-delete via `is_active`, `extra="forbid"` schemas, grep
  audit script in CI). The only architectural novelty is the partial
  unique index, which both engines support natively.
- 🧪 Tests: n/a at plan stage; the 7 SCs map 1:1 to the test files
  outlined in `plan.md` Project Structure (test_clients_create /
  _read / _update / _delete / _uniqueness).
- 📁 Files: 7 created under `specs/004-clients-management/` (plan,
  research, data-model, two contracts, quickstart, checklist).
- 🔁 Next prompts: `/sp.tasks clients` to convert this plan into the
  executable, dependency-ordered `tasks.md`. Optional ADRs:
  `/sp.adr clients-soft-delete-strategy`,
  `/sp.adr unique-partial-index-among-active-rows`,
  `/sp.adr phone-validation-regex-vs-library`.
- 🧠 Reflection: explicitly verified `app/main.py:18-28` already lists
  `("clients", "/clients")` in `MODULE_REGISTRY`, so the brief's "Phase 7:
  Integration — Register router in main.py" is a no-op for this feature
  (same pattern as features 002/003). Recorded in plan.md's Project
  Structure. Also verified all six clients module files exist as empty
  stubs — five will be filled, one (`dependencies.py`) stays as the
  empty docstring stub since this feature has no clients-specific
  Depends() factory beyond what `auth.dependencies` already provides.

## Evaluation notes (flywheel)

- Failure modes observed: none.
- Graders run and results (PASS/FAIL): `checklists/requirements.md`
  authored, all 16 boxes ticked.
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): in `/sp.tasks`, add a single
  CI integration test that exercises a *concurrent* create with the same
  email by running two `Session` instances against the same SQLite DB —
  if SQLite does not serialise the partial-unique-index violation
  cleanly, escalate to a Postgres-only test marked `@pytest.mark.pg`.
