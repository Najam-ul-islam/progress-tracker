---
id: 0001
title: Define projects spec
stage: spec
date: 2026-05-04
surface: agent
model: claude-sonnet-4-6
feature: 005-projects
branch: 004-clients-management
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: ["projects", "modules", "rbac", "share-cap", "soft-delete", "lifecycle", "spec"]
links:
  spec: specs/005-projects/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/005-projects/spec.md
tests:
  - n/a (spec stage; tests authored in /sp.tasks → /sp.implement)
---

## Prompt

`/sp.specify` for MODULE: Projects. Manage projects and their constituent
modules. A project belongs to a client (FK `project.client_id → client.id`)
and decomposes into one or more modules. Each module is assigned to a
single developer and carries a `share_percentage` that contributes to the
70% developer pool of the project's `total_amount` (the remaining 30% is
the company share, owned by the future payments module — out of scope
here). Endpoints: POST/GET/GET-by-id/PATCH/DELETE on `/projects`, plus
`GET /projects/{id}/progress`, plus POST `/projects/{id}/modules`,
PATCH/DELETE `/modules/{id}`, and PATCH `/modules/{id}/progress`. Roles:
admin (full), manager (create/read/update on projects and modules),
developer (read assigned + update own module progress). Status lifecycle:
`pending → active → completed`. Soft-delete on both project and module
(mirror feature 004). Six-file modular layout. NOT responsible for
payments, invoicing, or share distribution arithmetic — only the cap and
activation gate.

## Response snapshot

Authored `specs/005-projects/spec.md` covering:

- **7 user stories** — US1 create P1, US2 read/list P1 (with developer-
  visibility filter), US3 update + activate P1, US4 module CRUD P1, US5
  developer progress + auto-completion P1, US6 aggregate progress P2,
  US7 soft-delete P2. Each independently testable with full Given/When/
  Then acceptance scenarios.
- **27 functional requirements** grouped by ownership (FR-001..004),
  cross-module reads (FR-005, FR-009), date range (FR-006), reads &
  visibility (FR-007..008), share cap & activation (FR-010..013), status
  lifecycle (FR-014..017), schema discipline (FR-018), per-row ownership
  (FR-019..021), aggregate progress (FR-022), soft-delete (FR-023..025),
  generic 404 body (FR-026), module boundaries (FR-027).
- **7 success criteria** mirroring feature 004's measurable-outcome style:
  SC-001 latency < 200 ms, SC-002 lifecycle walk (create → modules → 70 →
  activate → 100×N → auto-complete), SC-003 dev-403-on-write everywhere,
  SC-004 cap invariant (sum ≤ 70 always; equality required to activate),
  SC-005 soft-delete invisibility on both entities, SC-006 zero JWT/bcrypt
  imports outside `core.security`, SC-007 audit-script catches forbidden
  imports.
- **Edge cases**: restoration (deferred), share re-use after module
  soft-delete (allowed), under-allocated activation (rejected — equality
  required), backwards-status transitions (rejected), completed-project-
  frozen (every module mutation 422), progress-on-non-active (422),
  developer-not-assignee patches own progress (403, not 404 because the
  module exists — this departs from the project-visibility 404 rule and
  is recorded), pagination (deferred), Decimal-as-string on the wire,
  arithmetic-mean for aggregate progress (not share-weighted; that's a
  payments concern).
- **Resolved decisions** block (locked from earlier conversation answers):
  - **Dual-gate share-cap** — sum ≤ 70.00 enforced on every write AND
    sum == 70.00 required to manually activate. Single-rule alternatives
    rejected because (a) cap-only would let a project be activated with
    under-allocated modules, defeating the 70/30 invariant; (b) equal-only
    would force operators to add modules in exact-fit order, blocking
    intermediate states.
  - **Hybrid status state machine** — manual `pending → active` (gated on
    share == 70), automatic `active → completed` (when every active module
    reads 100). `status="completed"` is NEVER accepted from any client;
    `ProjectUpdate.status` is `Literal["active"] | None` only. Humans set
    the start; math sets the end.
  - **Soft-delete on both entities** — mirrors feature 004. Hard delete
    rejected because future payment rows will FK to project and module,
    and the audit trail of "this work happened" is load-bearing for
    billing reconciliation.

Key opinionated decisions surfaced (and recorded in the spec, not the PHR):

- **Developer visibility = 404, not 403**, on `GET /projects/{id}` for
  unassigned projects. Rationale: 403 leaks the existence of an id; 404
  keeps existence opaque. Matches GitHub's private-repo-as-404 pattern and
  the generic-body rule in FR-026.
- **Developer ownership check on progress is service-layer, not Depends**.
  Rationale: the assignee identity is on the row, not on the request — a
  `Depends` factory would either re-read the row (doubling DB I/O) or take
  the module id from the path and bypass the canonical service helper.
- **No 409 in this feature** — there is no uniqueness column. Cap-overruns
  and activation-gate failures are 422 (unprocessable, not conflicting).
- **Decimal-as-string on the wire** for `total_amount`, `share_percentage`,
  `company_share`, `developer_share`. JSON `number` is IEEE 754; rounding
  is unacceptable for money and for the cap-equality check.

## Outcome

- ✅ Impact: feature 005 spec authored, aligned with the project's
  established RBAC, soft-delete, lifecycle, and audit patterns from
  features 002/003/004. Ready for `/sp.plan`.
- 🧪 Tests: n/a at spec stage; the 7 SCs are the executable contract that
  `/sp.tasks` will translate into integration tests.
- 📁 Files: 1 created (`specs/005-projects/spec.md`).
- 🔁 Next prompts: `/sp.plan` (architecture, contracts, data-model, ADR
  candidates: dual-gate-share-cap, hybrid-lifecycle, decimal-as-string,
  ownership-check-in-service), then `/sp.tasks`, then `/sp.implement`.
- 🧠 Reflection: explicitly recorded the 3 resolved decisions (dual-gate,
  hybrid status, soft-delete-on-both) inside the spec so `/sp.plan` does
  not re-litigate them.

## Evaluation notes (flywheel)

- Failure modes observed: the brief left "share cap rule" ambiguous
  (cap-only vs equal-only); resolved by promoting to dual-gate and
  recording rationale in spec Resolved Decisions §1.
- Graders run and results (PASS/FAIL): n/a (spec stage; spec lints in
  `/sp.plan` via `.specify/scripts/.../check-prerequisites`).
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): in `/sp.plan`, evaluate
  whether the cap check + activation gate share a single SUM query
  (they do; same query, different comparator) and whether the auto-
  completion helper can be a single `_maybe_autocomplete_project` invoked
  from four write paths (it can).
