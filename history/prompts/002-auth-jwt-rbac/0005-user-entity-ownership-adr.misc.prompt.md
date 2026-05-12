---
id: 0005
title: User Entity Ownership ADR
stage: misc
date: 2026-05-02
surface: agent
model: claude-sonnet-4-6
feature: 002-auth-jwt-rbac
branch: 002-auth-jwt-rbac
user: Muhammad Najam Ul Islam
command: /sp.adr
labels: [adr, auth, users, modular-monolith, ownership, boundaries]
links:
  spec: specs/002-auth-jwt-rbac/spec.md
  ticket: null
  adr: history/adr/ADR-0003-user-entity-ownership.md
  pr: null
files:
  - history/adr/ADR-0003-user-entity-ownership.md
  - history/prompts/002-auth-jwt-rbac/0005-user-entity-ownership-adr.misc.prompt.md
tests:
  - none (documentation-only change)
---

## Prompt

/sp.adr

TITLE: User Entity Ownership

STATUS: Accepted

CONTEXT:
The system requires a clear separation of concerns between authentication logic and user data management in a modular monolith architecture.

DECISION:
The User entity is owned by the `users` module.
The `auth` module will only handle authentication and authorization logic.

RATIONALE:
- Maintains clear module boundaries
- Prevents tight coupling between auth and user management
- Supports future features (profiles, roles, analytics, payments)

CONSEQUENCES:

Positive:
- Scalable and maintainable architecture
- Reusable User entity across modules
- Cleaner separation of concerns

Negative:
- Requires cross-module interaction (auth → users)

FUTURE CONSIDERATION:
If system evolves into microservices, the users module can be extracted as an independent service.

## Response snapshot

Created ADR-0003 (`history/adr/ADR-0003-user-entity-ownership.md`) capturing the User-entity
ownership decision as the third auth-feature ADR (companion to ADR-0001 JWT signing and ADR-0002
password hashing). The ADR expands on the user's input by:

- Clustering the decision: SQLModel home, repository surface, auth-side facade pattern, alembic
  ownership, cross-module FK direction, and role-enforcement boundary all bundled into one
  cohesive architectural commitment.
- Adding three named alternatives with rationale: User-owned-by-auth (rejected — couples
  consumers to auth's import graph), shared `core/identity` namespace (rejected — dissolves
  ownership), and per-consumer redefinition (rejected — fragments truth).
- Documenting a staged modular-monolith → microservices extraction path that exploits the
  facade pattern this ADR puts in place.
- Explicitly tying the decision to spec FR-016 / SC-007 and noting that contributor discipline
  is enforceable via a CI grep test ("auth.service must not import users.model").

This closes out the third pending ADR candidate flagged in `plan.md`. All three auth-feature
architectural decisions (signing strategy, hashing algorithm, entity ownership) are now
documented.

## Outcome

- ✅ Impact: One new ADR file created (ADR-0003). No code or schema changes. Plan/spec untouched.
- 🧪 Tests: none (documentation-only change).
- 📁 Files: `history/adr/ADR-0003-user-entity-ownership.md`, this PHR.
- 🔁 Next prompts: proceed to `/sp.tasks` to convert the plan into the executable, dependency-
  ordered tasks.md for the `auth` feature; the three auth ADRs are now in place to anchor the
  task generation.
- 🧠 Reflection: User input gave the standard skeleton (status, context, decision, rationale,
  consequences, future consideration). The ADR adds the missing cluster components (facade
  pattern, FK direction, role-guard boundary) and the three named alternatives required by the
  significance grader; without those, the ADR would have failed the "decision clustered, not
  atomic" and "list at least one alternative" checks.

## Evaluation notes (flywheel)

- Failure modes observed: none. Initial draft already clusters the decision (model + repository
  + facade + alembic + FK direction + role-guard boundary) rather than documenting only "where
  does the SQLModel live"; alternatives section enumerates three named alternatives with
  rejection reasoning.
- Graders run and results (PASS/FAIL):
  - Decision is clustered (not atomic): PASS
  - At least one alternative listed with rationale: PASS (three alternatives)
  - Pros and cons present for chosen approach and alternatives: PASS
  - Concise but sufficiently detailed: PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): if a future ADR needs to reference all three
  auth-feature ADRs as a unit, consider an "ADR index" table at `history/adr/README.md` linking
  the cluster.
