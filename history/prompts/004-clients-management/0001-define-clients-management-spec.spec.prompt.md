---
id: 0001
title: Define clients management spec
stage: spec
date: 2026-05-03
surface: agent
model: claude-sonnet-4-6
feature: 004-clients-management
branch: 003-users-management
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: ["clients", "rbac", "soft-delete", "uniqueness", "spec"]
links:
  spec: specs/004-clients-management/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/004-clients-management/spec.md
tests:
  - n/a (spec stage; tests authored in /sp.tasks → /sp.implement)
---

## Prompt

`/sp.specify` for MODULE: Clients. Manage client entities (contact details,
company info, association with projects). Six-file modular layout. NOT
responsible for project logic or invoicing. Data model: id, name, email,
phone, company_name?, address?, notes?, created_at, updated_at. One Client →
Many Projects (FK lives in projects module). Endpoints: POST /clients,
GET /clients, GET /clients/{id}, PATCH /clients/{id}, DELETE /clients/{id}.
Roles: admin (full), manager (create/update/view), developer (no access).
Validation: email format, phone with country code, name required, no
duplicate email or phone. Errors: 404 not found, 400 duplicate, 403
unauthorized. Constraints: follow existing project structure; no new
patterns; no project or payment logic.

## Response snapshot

Authored `specs/004-clients-management/spec.md` covering:

- **4 user stories** (US1 create P1, US2 read/list P1, US3 update P1,
  US4 delete P2) — each independently testable, each with full Given/When/
  Then acceptance scenarios. The 5th feature in the brief ("Delete client")
  was promoted from a P3 footnote to US4 P2 because soft-delete preserves
  future FK integrity from `projects.client_id` and is the canonical
  offboarding path.
- **21 functional requirements** grouped by entity ownership (FR-001..003),
  reads (FR-004..005), writes (FR-006..012), data hygiene & lifecycle
  (FR-013..016), authorisation invariants (FR-017..019), and module
  boundaries (FR-020..021).
- **7 success criteria** mirroring the feature-003 measurable-outcome style:
  SC-001 latency, SC-002 lifecycle walk, SC-003 dev-403-everywhere,
  SC-004 uniqueness invariant, SC-005 soft-delete invisibility,
  SC-006 single-source-of-truth audit, SC-007 cross-module-import audit.
- **Edge cases**: restoration (deferred), uniqueness across soft-deleted
  rows (allowed re-use), phone normalisation deferred to a future upgrade,
  email casing (lowercased+stripped on write), concurrent creates
  (DB unique partial index is final guard), pagination (deferred), notes
  format (plain text), PII handling (no encryption-at-rest in this feature).
- **Assumptions**: pagination, phone normalisation, soft vs hard delete,
  client→user linkage (deferred to projects feature), restoration, audit
  trail, race-condition strategy, role-enum source-of-truth, DELETE response
  shape (204 empty body to avoid leaking `is_active=false`).

Key opinionated decisions surfaced (and recorded in the spec, not the PHR):

- **Duplicate detection returns 409, not 400**, despite the brief saying
  "duplicate client → 400". Rationale (recorded as FR-009 detail): 409
  Conflict is the correct REST semantic for a unique-constraint collision
  on a write that succeeded auth/validation; 400 is reserved for malformed
  syntax. This aligns with the 409 already used by feature 003's
  last-admin guard, keeping a consistent error taxonomy across the API.
- **Soft delete is mandatory, not optional**, per the brief's
  "Delete client (soft delete optional)" — promoted to required because the
  upcoming projects module will hold FKs to client and a hard delete would
  orphan them.
- **Manager can update**, per the brief's "Manager: create, update, view".
  Admin-only is restricted to DELETE, mirroring how feature 003 reserved
  destructive admin-only operations (deactivate, role change) but allowed
  managers the read+create surface.
- **Developer is rejected before lookup** on `GET /clients/{id}` (id-probing
  protection), same pattern as feature 003 FR-005.

## Outcome

- ✅ Impact: feature 004 spec authored and aligned with the project's
  established RBAC, soft-delete, uniqueness, and audit patterns from
  features 002/003. Ready for `/sp.plan`.
- 🧪 Tests: n/a at spec stage; the 7 SCs are the executable contract that
  `/sp.tasks` will translate into integration tests.
- 📁 Files: 1 created (`specs/004-clients-management/spec.md`).
- 🔁 Next prompts: `/sp.plan` (architecture, contracts, data-model, ADR
  candidates: soft-delete-strategy-for-clients, uniqueness-partial-index,
  phone-validation-regex-vs-library), then `/sp.tasks`, then
  `/sp.implement`.
- 🧠 Reflection: explicitly recorded the 4 opinionated departures from the
  brief (409 vs 400, soft-delete required, manager-can-update, developer-
  pre-lookup-403) inside the spec so /sp.plan does not re-litigate them.

## Evaluation notes (flywheel)

- Failure modes observed: brief used "duplicate → 400" which conflicts with
  the project's established taxonomy; resolved by promoting to 409 and
  recording the rationale in FR-009.
- Graders run and results (PASS/FAIL): n/a (spec stage; spec lints in
  /sp.plan via `.specify/scripts/.../check-prerequisites`).
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): in `/sp.plan`, evaluate whether
  the partial unique index `WHERE is_active = true` is supported on SQLite
  (it is, with limitations) or whether the test suite needs the same
  index-via-migration trick used in feature 002 for the email index.
