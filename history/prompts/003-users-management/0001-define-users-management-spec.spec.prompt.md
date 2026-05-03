---
id: 0001
title: Define Users Management Spec
stage: spec
date: 2026-05-02
surface: agent
model: claude-sonnet-4-6
feature: 003-users-management
branch: 003-users-management
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: [spec, users, rbac, profile, modular-monolith]
links:
  spec: specs/003-users-management/spec.md
  ticket: null
  adr: history/adr/ADR-0003-user-entity-ownership.md
  pr: null
files:
  - specs/003-users-management/spec.md
  - specs/003-users-management/checklists/requirements.md
  - history/prompts/003-users-management/0001-define-users-management-spec.spec.prompt.md
tests:
  - none (spec-only stage; tests will be authored in tasks/red/green stages)
---

## Prompt

/sp.specify

MODULE: Users

PURPOSE:
Own and manage the User entity, including profile data, role assignment, and developer-related metadata for the SaaS system.

---

SCOPE:

This module is responsible for:
- User entity (single source of truth)
- User profile management
- Role storage
- Developer-related attributes

This module is NOT responsible for:
- Authentication (handled by auth module)
- JWT/token logic

---

DEPENDENCIES:

- db/session (database access)
- shared/constants (roles)
- auth module (for protected routes via dependencies)

---

DATA MODEL (CORE ENTITY):

User entity MUST include:

- id (primary key)
- name (string)
- email (unique, indexed)
- password_hash (string)
- role (enum: admin | manager | developer)
- is_active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)

OPTIONAL (for future scaling):
- phone
- profile_image
- skills (for developers)

---

ROLE RULES:

- Each user MUST have exactly one role
- Roles are:
  - admin (full system access)
  - manager (project/client control)
  - developer (task execution)

---

FEATURES:

1. Get user by ID
2. Get all users (with filtering)
3. Update user profile
4. Activate/Deactivate user
5. List developers (role = developer)

---

INPUTS:

Update User:
- name (optional)
- role (optional)
- is_active (optional)

---

OUTPUTS:

User Response:
- id
- name
- email
- role
- is_active
- created_at

---

VALIDATION RULES:

- Email must be unique
- Role must be valid enum
- Cannot remove required fields
- Only admin can change roles
- Only admin can deactivate users

---

ACCESS CONTROL:

- All endpoints require authentication
- Admin:
  - full access
- Manager:
  - view users
- Developer:
  - view own profile only

---

API ENDPOINTS:

- GET /users/me
- GET /users/{id}
- GET /users
- PATCH /users/{id}
- PATCH /users/{id}/status
- GET /users/developers

---

REPOSITORY LAYER:

Responsibilities:
- Fetch user by ID
- Fetch all users
- Update user
- Filter by role

NO business logic here

---

SERVICE LAYER:

Responsibilities:
- Validate updates
- Enforce role permissions
- Apply business rules

Examples:
- Only admin can change role
- Prevent self-deactivation (optional)

---

ROUTES LAYER:

Responsibilities:
- Handle request/response
- Call service layer only
- Use auth dependencies

NO direct DB access

---

SCHEMAS:

- UserRead
- UserUpdate
- UserListResponse

---

INTEGRATION WITH AUTH:

- Auth module uses User model from this module
- Users module does NOT depend on auth logic
- Protected routes use auth dependencies

---

ERROR HANDLING:

- User not found → 404
- Unauthorized → 403
- Invalid input → 400

---

CONSTRAINTS:

- MUST follow modular structure:
  - model.py
  - schema.py
  - repository.py
  - service.py
  - routes.py
  - dependencies.py

- NO duplication of User model anywhere else
- NO authentication logic here

---

SUCCESS CRITERIA:

- User entity is centralized
- Users can be retrieved and updated
- Role-based restrictions enforced
- Developers list works correctly
- Integration with auth is seamless

---

OUTPUT EXPECTATION:

Claude Code must generate:
- SQLModel User model (if not already exists)
- Schemas
- Repository layer
- Service layer with validation logic
- API routes with RBAC enforcement

---

FOLLOW EXISTING PROJECT STRUCTURE STRICTLY.
DO NOT CREATE NEW PATTERNS.

## Response snapshot

Created the `003-users-management` feature scaffold:

- **Branch**: `003-users-management` (local, not yet pushed). Numbering: highest existing was 002, next is 003.
- **Spec**: `specs/003-users-management/spec.md` written from the user's structured brief plus the `.specify/templates/spec-template.md` skeleton. Five user stories prioritised P1/P1/P1/P2/P2:
  - **US1** read-self via `GET /users/me` (every role)
  - **US2** admin/manager list and read via `GET /users`, `GET /users/{id}` (developer self-only)
  - **US3** admin profile/role edit via `PATCH /users/{id}`
  - **US4** admin activate/deactivate via `PATCH /users/{id}/status`
  - **US5** project-assignment helper `GET /users/developers`
- **Functional requirements**: 20 FRs grouped by *Entity ownership* (FR-001..003 — extends ADR-0003 with `is_active`, `updated_at`), *Reads* (FR-004..007), *Writes* (FR-008..012), *Authorisation invariants* (FR-013..016), *Data hygiene* (FR-017..019), and *Module boundaries* (FR-020 — adds a CI grep audit alongside SC-006/SC-007 from feature 002).
- **Success criteria**: 7 measurable, technology-agnostic SCs covering `/me`, full admin lifecycle, developer 403 sweep, deactivated-login 401, last-admin guard, no `password_hash` leak, single User definition.
- **Non-trivial scope decisions** I made and documented in *Edge Cases* + *Assumptions*:
  - Password change and email change are explicitly **out of scope** (deferred to future slices because each requires its own auth flow).
  - Self-service edits (a `PATCH /users/me`) are **out of scope** — only admins write through this feature.
  - The "last admin" guard (FR-014) is the only transactional requirement; documented as `SELECT … FOR UPDATE` / serialisable transaction in *Assumptions*.
  - Pagination deferred but the array→envelope migration is sketched as non-breaking.
  - The `is_active=false` ⇒ login 401 invariant (FR-013) is described as an *extension* to the auth module's `authenticate_user` (preserves SC-005's byte-identical 401 from feature 002).
- **Checklist**: `specs/003-users-management/checklists/requirements.md` — all items marked PASS on first iteration. Notes call out the deliberate `PATCH /users/{id}` vs `PATCH /users/{id}/status` overlap (kept for audit clarity) and the contractual continuities back into feature 002 (which are *not* implementation leakage).

**Script note**: `create-new-feature.ps1` was invoked once. It checked out the branch and copied the spec template to `specs/003-users-management/spec.md` before exiting with a non-fatal PowerShell parameter-binding warning (the long positional description tripped the parser; the script had already done the file-creation work it needed). The PHR-style `history/prompts/003-users-management/` directory was created manually to compensate for the early exit. No state was lost.

## Outcome

- ✅ Impact: spec.md, requirements.md, and the PHR directory exist on a fresh `003-users-management` branch. The feature is ready for `/sp.clarify` (none of the 3 NEEDS CLARIFICATION budget was used) or directly for `/sp.plan`.
- 🧪 Tests: none — spec stage. The 7 success criteria each describe an end-to-end test that the eventual `/sp.tasks` step will mechanically translate into pytest cases.
- 📁 Files: 3 new (`spec.md`, `checklists/requirements.md`, this PHR). No code changes.
- 🔁 Next prompts:
  - `/sp.plan users` — draft the technical plan (six-file modular layout, integration points with auth, alembic revision adding `is_active` + `updated_at` columns).
  - Optionally `/sp.clarify` first if any of the deferred items (email change, self-service edits, audit log) need to be re-scoped before planning.
- 🧠 Reflection: the user's brief was unusually complete — fields, endpoints, role rules, RBAC matrix, error codes, and the modular-structure constraint were all stated explicitly. The spec's main value-add was (a) prioritising the five features into independently-testable P1/P2 stories, (b) introducing FR-013 (deactivated-user login 401) as a contract that bridges this feature back into the auth module without violating ADR-0003, and (c) writing FR-014 (last-admin guard) as a *transactional* invariant rather than a soft policy. Zero clarification questions needed.

## Evaluation notes (flywheel)

- Failure modes observed:
  - `create-new-feature.ps1` exited with a parameter-binding warning when the feature description contained the literal word `prompts` (one of the script's positional edge cases). The branch and spec.md were already created at the point of exit, but the `history/prompts/<branch>/` mkdir step was skipped — recreated manually. Worth filing as a script bug: pass the description through `--` or quote-strip more aggressively in step `New-Item -Path $promptsDir`.
- Graders run and results (PASS/FAIL):
  - All 16 checklist items in `requirements.md` PASS on first iteration (no [NEEDS CLARIFICATION] markers, no implementation leakage, all SCs measurable and tech-agnostic).
  - 5 user stories, each with an explicit *Independent Test* paragraph: PASS.
  - Each FR has at least one mapped acceptance scenario: PASS.
  - Each SC is verifiable without referring to FastAPI/SQLModel/specific code paths: PASS.
- Prompt variant (if applicable): none.
- Next experiment (smallest change to try): if `/sp.clarify` is run later and surfaces a need for a `PATCH /users/me` endpoint, add it as US6 (P3) rather than splitting US3. Keeps the admin-only write surface clean and lets the self-service slice stand alone.
