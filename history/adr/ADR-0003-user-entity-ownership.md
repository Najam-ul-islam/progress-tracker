# ADR-0003: User Entity Ownership

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together.

- **Status:** Accepted
- **Date:** 2026-05-02
- **Feature:** 002-auth-jwt-rbac
- **Context:** The progress-tracker SaaS backend is a FastAPI + SQLModel modular monolith with a
  six-file layout per module (`model / schema / repository / service / routes / dependencies`).
  The auth feature introduces the first concrete user record. Several modules will eventually
  need to reference users — projects (assignees), clients (account owners), analytics (actor
  attribution), payments (billing principal), and any future profile / preferences module — so
  the question of which module *owns* the `User` SQLModel and its `user` table is a one-time
  cross-cutting commitment. Owning the entity in the wrong place would either pull authentication
  concerns into every consumer (if owned by `auth`) or fragment the data across modules (if each
  consumer redefines its own user shape). The decision must also keep a future split into
  separately-deployed services on the table without forcing it today.

<!-- Significance checklist (all true):
     1) Impact: ownership of the canonical identity entity is a long-term architectural
        commitment. Every cross-module foreign key resolves through this choice; reversing it
        later forces FK migrations, import-graph surgery, and a re-rewrite of role-guard wiring.
     2) Alternatives: User-owned-by-auth, User-owned-by-users (this decision), and a shared
        `core/identity` namespace are all viable, with real tradeoffs on coupling, blast radius,
        and migration cost.
     3) Scope: cross-cutting — touches every module that will ever reference a user, the auth
        repository's facade pattern, the alembic migration's table location, and the future
        microservice extraction plan. -->

## Decision

The `User` entity (SQLModel and `user` table) is **owned by the `users` module**, with the
following components forming a single decision cluster:

- **SQLModel definition**: `app/modules/users/model.py::User` is the single source of truth for
  user identity, credentials storage (`password_hash`), and role assignment.
- **Repository surface**: `app/modules/users/repository.py` exposes the persistence-shaped
  helpers (`get_user_by_email`, `get_user_by_id`, `create_user`). It is the **only** module that
  issues SQL against the `user` table.
- **Auth-side facade**: `app/modules/auth/repository.py` is a thin pass-through to
  `users.repository`. The `auth` service / dependencies layer never imports `users.model`
  directly — it goes through this facade so the dependency direction stays
  `auth → users` and never the other way.
- **Alembic ownership**: the migration that creates `user` (`20260502_create_user_table.py`) is
  semantically owned by the users module's domain even though all alembic revisions live in the
  shared `backend/alembic/versions/` directory.
- **Cross-module FKs (future)**: every other module (`projects`, `clients`, analytics,
  payments, …) declares foreign keys to `user.id` and imports the `User` type from
  `app.modules.users.model`. Auth is not on this import graph — it consumes users via the
  repository facade only.
- **Role enforcement boundary**: `auth/dependencies.py` provides `get_current_user`,
  `require_admin`, `require_manager`, `require_developer`, `require_any`. These are the only
  authorisation primitives any module is allowed to import; the `users` module exposes the
  identity, the `auth` module exposes the policy.

This locks in the FR-016 / SC-007 contract from the spec: "the User table is owned by the
`users` module; `auth/repository.py` is a thin facade calling into `users/repository.py`."

## Consequences

### Positive

- **Clear module boundaries**: identity (data) lives in `users`; identity verification (policy)
  lives in `auth`. Each module's six files have one obvious purpose, and the line between them
  matches the line between "what the user is" and "is this request allowed."
- **Reusable User entity across modules**: every consumer (`projects`, `clients`, analytics,
  payments, future profile module) imports the same `User` from `users.model` and FKs to the
  same `user.id`. There is no risk of two modules disagreeing on the user shape.
- **Cleaner separation of concerns**: the `auth` module's surface area shrinks to the
  authentication and authorisation primitives only. It can be reasoned about — and replaced —
  without touching the persistence model. This is exactly the property that makes a future
  rip-and-replace of the auth layer (e.g., swapping JWT for an external IdP) feasible.
- **Microservice-extraction path stays open**: because consumers depend on `users.model`
  directly (not on auth re-exporting it), the `users` module is a defensible candidate for
  extraction into its own service later. The auth module can either follow it or stay co-located
  with the API gateway.
- **Aligned with the alembic single-table-per-module pattern**: one revision creates one table,
  the `users` module conceptually owns it, and the rest of the codebase imports the model from
  exactly one place.

### Negative

- **Requires cross-module interaction (auth → users)**: every auth code path that needs an
  identity (register, login, `get_current_user`) goes through the facade in
  `auth.repository → users.repository`. This is one extra hop on the import graph; the
  alternative (auth owns `User`) would not have it.
- **Two repositories that must stay in sync**: `auth.repository` mirrors a subset of
  `users.repository`'s API. If the users-side signature changes, the facade has to follow.
  Mitigation: keep the facade *thin* — pass-through only, no logic — so the only thing it can
  drift on is the function signature, which is type-checked.
- **Discipline tax on contributors**: it is tempting for a future contributor to do
  `from app.modules.users.model import User` inside the auth service to "save a hop". This is
  exactly the lock-in we're trying to prevent. Mitigation: the spec's FR-016 / SC-007 are
  enforceable by a one-line grep test in CI ("auth.service must not import users.model").
- **Slightly less obvious for newcomers**: a developer touching auth-only changes still has to
  understand the users module's repository to follow the request flow end-to-end. The win is
  that they only have to understand its public surface, not its internals.

## Alternatives Considered

### Alternative A — `User` owned by the `auth` module

- **Shape**: `app/modules/auth/model.py::User` is the SQLModel; `auth.repository` issues all SQL
  against `user`; every consumer module imports `User` from auth and FKs to `auth.user.id`.
- **Why rejected**: this puts every other module on the auth module's import graph permanently.
  Any change to auth (a new dependency, a token-format refactor, a refresh-token migration)
  forces a re-import / re-test of everyone who only wanted the user record. It also tangles
  policy with data: a contributor adding a profile field would be editing the auth module,
  which is precisely where the smallest-viable-diff principle most wants editors to keep their
  hands off. Finally, it makes the future microservice split harder — extracting auth would
  drag the canonical user table along with it, even though the table belongs to "everyone".
- **When this would have been the right choice**: a single-feature auth-only product where the
  only thing the system ever does with users is authenticate them. Not this product.

### Alternative B — `User` lives in a shared `app/core/identity` (or `app/db/models`) namespace

- **Shape**: the user model is module-less, sitting in a cross-cutting `core` package; both
  `auth` and `users` import it from there.
- **Why rejected**: it dissolves the question rather than answering it. With no module owning
  the entity, the implicit answer becomes "everyone owns it" — which means any module can add
  fields, migrations, or repository helpers without a clear review boundary. The six-file
  modular layout the project has committed to is exactly the antidote to this. It also makes
  microservice extraction harder in a different way: `core/identity` has no obvious deployment
  unit, so an extraction would require first re-homing the model into a module.
- **When this would have been the right choice**: a smaller codebase where the modular layout
  is overkill, or a project that has already standardised on a single shared models namespace
  by convention.

### Alternative C — Each consumer module redefines its own user reference

- **Shape**: `projects.model` declares its own minimal `ProjectUser` (id, name, email);
  `clients.model` declares `ClientContact` with the same shape; the auth module owns the real
  thing and emits events.
- **Why rejected**: creates N truth sources for "who is this user", forces every consumer to
  duplicate validation rules (email lowercasing, role literals), and turns every feature change
  into a fan-out edit across modules. The whole reason to have a `users` module is to avoid
  this fragmentation.
- **When this would have been the right choice**: an event-driven CQRS architecture with
  read-model projections per service — an architecture this project has explicitly chosen not
  to adopt for the modular monolith phase.

## Future migration path (modular monolith → microservices)

When the migration trigger fires (typically: organisation grows past the team size where one
deploy artifact is comfortable, or a single domain needs an independent release cadence), the
smallest-viable-change rollout is:

1. Lift `app/modules/users/` into its own deployable service (`users-service`) behind an
   internal HTTP/gRPC contract that mirrors `users.repository`'s public functions
   (`get_user_by_email`, `get_user_by_id`, `create_user`).
2. Replace the in-process facade in `auth/repository.py` with a thin client that calls the new
   service. The auth module's call sites do not change.
3. Replace consumer FKs to `user.id` with a service-side reference (the exact mechanism — UUID
   handle, eventual-consistency cache, or a federated query — is a separate ADR at extraction
   time).
4. Decommission the in-process `users` module from the API process.

The path matters because the project deliberately ships as a modular monolith today (per the
plan's "modular monolith" framing); the ADR's job is to keep this path open without paying its
cost up front.

## References

- Feature Spec: [`specs/002-auth-jwt-rbac/spec.md`](../../specs/002-auth-jwt-rbac/spec.md)
  (FR-016 — User table owned by `users` module; SC-007 — `auth/repository.py` is a thin facade)
- Implementation Plan: [`specs/002-auth-jwt-rbac/plan.md`](../../specs/002-auth-jwt-rbac/plan.md)
  (§ "Architectural Decision suggestions" — flagged this decision as ADR candidate #3)
- Data Model (`User` SQLModel definition, `user` table schema):
  [`specs/002-auth-jwt-rbac/data-model.md`](../../specs/002-auth-jwt-rbac/data-model.md)
- Related ADRs:
  - [`ADR-0001`](./ADR-0001-jwt-signing-strategy.md) — JWT signing strategy (the policy half of
    auth, complementary to this entity-ownership decision).
  - [`ADR-0002`](./ADR-0002-password-hashing-algorithm.md) — Password hashing algorithm
    (the column shape this ADR governs).
- Evaluator Evidence: PHR
  `history/prompts/002-auth-jwt-rbac/0005-user-entity-ownership-adr.misc.prompt.md`
