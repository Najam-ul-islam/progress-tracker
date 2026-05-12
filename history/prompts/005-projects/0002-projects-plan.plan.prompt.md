---
id: 0002
title: Projects plan
stage: plan
date: 2026-05-04
surface: agent
model: claude-sonnet-4-6
feature: 005-projects
branch: 004-clients-management
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["projects", "modules", "rbac", "share-cap", "lifecycle", "decimal", "soft-delete", "plan"]
links:
  spec: specs/005-projects/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/005-projects/plan.md
  - specs/005-projects/research.md
  - specs/005-projects/data-model.md
  - specs/005-projects/contracts/openapi.yaml
  - specs/005-projects/contracts/access-control-matrix.md
  - specs/005-projects/quickstart.md
  - specs/005-projects/checklists/requirements.md
tests:
  - n/a (plan stage; tests authored in /sp.tasks → /sp.implement)
---

## Prompt

`/sp.plan` for MODULE: Projects. OBJECTIVE: implement projects + modules
inside one slice with RBAC, share-cap, hybrid lifecycle (manual
pending→active gated on share=70; automatic active→completed when all
modules at 100), soft-delete on both entities, integrated into the
uv-based modular system. 8 phases: Dependency Check, Models (Project +
ProjectModule), Schemas, Repository, Service, Routes (10 endpoints across
`/projects` and `/modules`), Integration (router register at `/projects`
already mounted; module owns both prefixes), Validation
(`uv run uvicorn app.main:app --reload` + `/docs`). Constraints: no
business logic in routes, RBAC via auth, modular structure only,
Decimal-as-string for money fields, dual-gate share rule.

## Response snapshot

Authored 7 plan artefacts under `specs/005-projects/`:

- **`plan.md`** — top-level plan: summary (six-file slice, two SQLModels,
  ten endpoints, single alembic revision `20260504_project`, one new
  audit script), technical context (Python 3.13, no new deps, Decimal
  stdlib, SQLite-in-mem + StaticPool for tests), constitution check
  (template constitution → default policies + cross-feature continuity),
  project structure (one alembic revision, six implementation files
  filling five with `dependencies.py` empty, six new test files, one
  conftest one-liner, one new audit script, **`app/main.py` unchanged** —
  the projects router is already in `MODULE_REGISTRY`), routing note
  explaining how a single router declares both `/projects` and
  `/modules/{id}` operations via full-path decorators on a `prefix=""`
  router, phase-0/1 outputs table, complexity tracking (none), 4 ADR
  suggestions.
- **`research.md`** (R1–R10) — narrowly-scoped technical decisions:
  - **R1** Decimal arithmetic via stdlib `decimal`; cap-equality and
    cap-cap comparisons use Decimal to avoid float rounding. Trade-off
    recorded; ADR candidate flagged (decimal-as-string).
  - **R2** Hybrid status state machine: manual pending→active, automatic
    active→completed. ADR candidate flagged.
  - **R3** Cross-row CHECK constraints rejected (no DB-level cap trigger);
    cap rule lives in service layer with a single SUM query. The
    activation gate is the same SUM with a different comparator.
  - **R4** `_maybe_autocomplete_project` helper invoked from four write
    paths (`POST module`, `PATCH module`, `PATCH module progress`,
    `DELETE module`) — single source of truth for the auto-completion
    transition.
  - **R5** Per-row visibility filter for developers in repository
    (`list_projects_for_user`, `get_project_for_user`); 404 hides
    existence (mirrors GitHub private-repo pattern).
  - **R6** Per-row ownership check for `update_module_progress` lives in
    the service (data-dependent; `Depends` would either double DB I/O or
    bypass the canonical helper). ADR candidate flagged.
  - **R7** Soft-delete on both project and module via `is_active` boolean;
    no reactivation path; future restoration explicitly out of scope.
  - **R8** CHECK constraints (status enum, progress 0..100, share 0..70,
    total_amount > 0, end_date >= start_date) run on both Postgres and
    SQLite — no engine-specific guards needed.
  - **R9** Six test files (1:1 with user stories plus aggregate +
    soft-delete on US6/US7), reusing conftest fixtures from features
    002/003/004 plus three new fixtures (`seed_client`,
    `seed_project_pending`, `seed_project_active_with_modules`).
  - **R10** Decimal-as-string on the wire — every consumer must parse
    strings, not numbers. ADR candidate flagged.
- **`data-model.md`** — two tables with full column specs (project: 13
  cols; project_module: 11 cols), CHECK constraints inline, indexes
  (`ix_project_client_id`, `ix_project_is_active`,
  `ix_project_module_project_id`, `ix_project_module_assigned_developer_id`,
  `ix_project_module_is_active`), state-transition diagrams for both
  entities, FR-mapping table, full Pydantic v2 schemas (closed via
  `model_config = ConfigDict(extra="forbid")` on every patch schema),
  alembic migration outline with FK ON DELETE RESTRICT.
- **`contracts/openapi.yaml`** — HTTP contract for all 10 endpoints,
  Decimal fields declared `type: string`, `ProjectUpdate.status` enum is
  `[active, null]` only (FR-014/FR-015), bearer-auth on every operation.
- **`contracts/access-control-matrix.md`** — internal RBAC table (role ×
  endpoint), notation ✅ / ✅ʳ / 🚫 403 / 🔒 401, route-to-dependency
  pseudocode for all 10 routes, 11 typed-exception → HTTP-status mappings,
  401 → 403 → 404 → 422 → 2xx ordering rule (no 409 — no uniqueness
  collisions in this feature).
- **`quickstart.md`** — 7-step manual walkthrough (sync deps, migrate,
  pytest, uvicorn, seed users + client + capture tokens, walk all 7 user
  stories with curl, run audit scripts, Swagger sanity check).
- **`checklists/requirements.md`** — spec-quality checklist (all items
  ✅) with notes section capturing rationale for dual-gate, hybrid
  status, soft-delete-both, ownership-in-service, visibility-as-404,
  decimal-as-string, arithmetic-mean-progress, auto-completion-fires-once,
  no-uniqueness.

ADR suggestions surfaced (no auto-creation; user consent required):

1. **Dual-gate share-cap rule** — long-term impact + 3 alternatives
   considered + cross-cutting (every module write path runs the cap
   check; activation gate shares the same query). 📋 Suggested.
2. **Hybrid project lifecycle** — long-term impact + 3 alternatives
   considered + cross-cutting (auto-completion fires from 4 write paths).
   📋 Suggested.
3. **Decimal-as-string serialisation** — long-term impact (every
   consumer must parse strings) + 1 alternative considered + cross-
   cutting (4 fields × every endpoint). 📋 Suggested.
4. **Service-layer ownership check** — long-term impact + 1 alternative
   considered + cross-cutting (rule lives in `update_module_progress`,
   tested against 6 role × ownership combinations). 📋 Suggested.

## Outcome

- ✅ Impact: phase 0 + phase 1 complete. The plan, research,
  data-model, contracts, quickstart, and checklist are aligned and
  internally consistent. Ready for `/sp.tasks`.
- 🧪 Tests: n/a at plan stage; six test files outlined in plan structure
  (one per user story plus the cross-cutting `test_projects_progress.py`
  for US6 + US7).
- 📁 Files: 7 created under `specs/005-projects/`.
- 🔁 Next prompts: `/sp.tasks`, then `/sp.implement`. ADR suggestions
  await user consent.
- 🧠 Reflection: structurally parallel to feature 004's plan artefact set
  (same 7 files, same internal cross-references). The single new
  cross-cutting concern is the cap/activation/auto-complete triangle, all
  three of which collapse into a single SUM query and a single helper.

## Evaluation notes (flywheel)

- Failure modes observed: routing concern — projects router needs to own
  both `/projects` and `/modules/{id}` operations without changing
  `MODULE_REGISTRY`. Resolved with a `prefix=""` router and full-path
  operation decorators (mirrors how feature 002's `auth/login`,
  `auth/register`, `auth/me` co-exist).
- Graders run and results (PASS/FAIL): n/a (plan stage; quickstart and
  checklist are the executable contracts that `/sp.tasks` will translate
  into integration tests).
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): in `/sp.tasks`, encode the
  same-file serialisation chains for `service.py` (every business-rule
  task) and `routes.py` (every endpoint task) so the dependency graph is
  unambiguous.
