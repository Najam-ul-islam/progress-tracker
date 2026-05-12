---
id: 0003
title: Projects tasks
stage: tasks
date: 2026-05-04
surface: agent
model: claude-sonnet-4-6
feature: 005-projects
branch: 004-clients-management
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["projects", "modules", "tasks", "tdd", "share-cap", "lifecycle", "soft-delete"]
links:
  spec: specs/005-projects/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/005-projects/tasks.md
tests:
  - tests/test_projects_create.py (planned)
  - tests/test_projects_read.py (planned)
  - tests/test_projects_update.py (planned)
  - tests/test_modules_crud.py (planned)
  - tests/test_modules_progress.py (planned)
  - tests/test_projects_progress.py (planned)
---

## Prompt

`/sp.tasks` for MODULE: Projects. Convert plan + design artefacts into a
dependency-ordered, executable task list. Honour: TDD (tests before
implementation per user story), six-file modular layout, same-file
serialisation, dual-gate share-cap, hybrid status, soft-delete on both
entities, Decimal-as-string, FR-027 module boundaries with audit script.

## Response snapshot

Authored `specs/005-projects/tasks.md` — 39 tasks across 10 phases:

- **Phase 1 — Setup (T001–T004)**: dependency check (no new deps), test
  infrastructure check, alembic env scan, branch hygiene.
- **Phase 2 — Foundational (T005–T011)**: SQLModels (`Project`,
  `ProjectModule`) in `model.py` (T005), Pydantic v2 schemas in
  `schema.py` (T006: `ProjectCreate / ProjectUpdate / ProjectRead /
  ModuleCreate / ModuleUpdate / ModuleProgressUpdate / ModuleRead /
  ModuleProgressSummary / ProjectProgressResponse`), repository helpers
  in `repository.py` (T007: 11 narrow helpers including
  `sum_active_module_shares`, `list_active_modules`,
  `list_projects_for_user`, `get_project_for_user`,
  `count_modules_at_full_progress`), service skeleton + 11 typed
  exceptions (T008–T009), alembic revision `20260504_project.py` (T010),
  one-line conftest edit (T011: `from app.modules.projects.model import
  Project, ProjectModule  # noqa: F401`).
- **Phase 3 — US1 (T012–T014)**: write `test_projects_create.py` (RED),
  implement `service.create_project` (T013) including FR-005 client-active
  lookup and FR-006 date-range check, wire `POST /projects` route (T014).
- **Phase 4 — US2 (T015–T017)**: write `test_projects_read.py` (RED),
  implement `service.list_projects / get_project` with developer-
  visibility filter (T016), wire `GET /projects` and
  `GET /projects/{id}` (T017).
- **Phase 5 — US3 (T018–T020)**: write `test_projects_update.py` (RED),
  implement `service.update_project / activate_project` with the
  activation gate sharing the SUM query (T019), wire `PATCH
  /projects/{id}` (T020).
- **Phase 6 — US4 (T021–T026)**: write `test_modules_crud.py` (RED),
  implement `service.create_module` (T022: FR-009 developer eligibility,
  FR-010 share cap, FR-016 not-on-completed), `service.update_module`
  (T023: FR-011 cap excludes own share), `service.delete_module` (T024),
  `_maybe_autocomplete_project` helper (T025) — single source of truth
  invoked from 4 write paths, wire 3 routes
  (`POST /projects/{id}/modules`, `PATCH /modules/{id}`,
  `DELETE /modules/{id}`) (T026).
- **Phase 7 — US5 (T027–T030)**: write `test_modules_progress.py` (RED),
  implement `service.update_module_progress` (T028: FR-019 ownership,
  FR-021 active-only, invokes `_maybe_autocomplete_project`), regression
  test for completed-project-frozen on progress (T029), wire `PATCH
  /modules/{id}/progress` (T030).
- **Phase 8 — US6 (T031–T033)**: write aggregate progress test (in
  `test_projects_progress.py`), implement `service.compute_progress` as
  arithmetic mean across active modules (T032), wire
  `GET /projects/{id}/progress` (T033).
- **Phase 9 — US7 (T034–T036)**: write soft-delete + share-reuse tests,
  implement `service.delete_project` and confirm
  `service.delete_module` frees share for re-use plus invokes
  `_maybe_autocomplete_project` (T035), wire `DELETE /projects/{id}`
  (T036).
- **Phase 10 — Polish (T037–T039)**: write
  `scripts/audit_projects_imports.sh` (T037 — FR-027 enforcement; allow-
  list: `auth.dependencies`, `auth.schema`, `users.repository`,
  `clients.repository`), run full quickstart manually (T038), README/
  CHANGELOG update if applicable (T039).

Same-file serialisation chains explicitly recorded:

- **`service.py`** chain (sequential, single-writer per task):
  T009 → T013 → T016 → T019 → T022 → T023 → T024 → T025 → T028 → T029 →
  T032 → T035 → T038. Every task that touches `service.py` waits for the
  previous one to merge to keep diffs reviewable.
- **`routes.py`** chain (sequential): T014 → T017 → T020 → T026 → T030 →
  T033 → T036.
- **`repository.py`** is single-write at T007 (all 11 helpers in one
  pass) — no later task touches it; this avoids reviewer churn.
- **`schema.py`** is single-write at T006 — closed schemas locked from
  the start.
- **`model.py`** is single-write at T005.

## Outcome

- ✅ Impact: tasks.md authored. The dependency graph is unambiguous; the
  TDD ordering is enforced by per-user-story RED tasks preceding GREEN
  tasks; the same-file chains prevent merge conflicts.
- 🧪 Tests: 6 test files planned, 1:1 with user stories plus aggregate +
  soft-delete combined into `test_projects_progress.py` (US6 + US7).
- 📁 Files: 1 created (`specs/005-projects/tasks.md`).
- 🔁 Next prompts: `/sp.implement` to execute the task list against the
  branch. Optionally, ADR commands for the 4 suggested decisions before
  implementation begins.
- 🧠 Reflection: 39 tasks vs feature 004's ~30 — the delta is the
  cap/activation/auto-complete triangle (5 extra service tasks) and the
  second entity (ProjectModule) which adds module-CRUD as a separate user
  story. The single biggest reviewer-friendliness win is locking
  `repository.py` and `schema.py` to one-write tasks.

## Evaluation notes (flywheel)

- Failure modes observed: tempted to split `repository.py` across user
  stories (one task per repo helper); rejected because it would create
  ~10 sequential tasks blocking each other for trivial diffs. Single-
  write at T007 is the right granularity.
- Graders run and results (PASS/FAIL): n/a (tasks stage; the task list
  itself is the contract `/sp.implement` will execute).
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): during `/sp.implement`,
  measure whether the `_maybe_autocomplete_project` helper fits in <30
  lines (it should — one COUNT, one MIN, one UPDATE) — if it grows,
  factor out a `_modules_all_complete(session, project_id) -> bool`
  predicate.
