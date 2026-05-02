---
id: 0003
title: jwt signing strategy adr
stage: misc
date: 2026-05-02
surface: agent
model: claude-sonnet-4-6
feature: 002-auth-jwt-rbac
branch: 002-auth-jwt-rbac
user: Muhammad Najam Ul Islam
command: /sp.adr
labels: [adr, auth, jwt, hs256, signing, security]
links:
  spec: specs/002-auth-jwt-rbac/spec.md
  ticket: null
  adr: history/adr/ADR-0001-jwt-signing-strategy.md
  pr: null
files:
  - history/adr/ADR-0001-jwt-signing-strategy.md
tests:
  - none (ADR documentation; no code or tests changed)
---

## Prompt

/sp.adr

TITLE: JWT Signing Strategy

STATUS: Accepted

CONTEXT:
The system requires JWT-based authentication for a modular monolith SaaS built with FastAPI. Tokens must be secure, easy to manage, and suitable for a single-backend architecture.

DECISION:
Use HS256 (symmetric signing) for JWT tokens.

RATIONALE:
- Simpler implementation (single shared secret)
- No key distribution required
- Faster to implement and maintain
- Well-supported in FastAPI ecosystem

CONSEQUENCES:

Positive:
- Minimal operational complexity
- Faster development
- Easy integration with existing auth flow

Negative:
- Not ideal for multi-service architectures
- Requires secure handling of shared secret

FUTURE CONSIDERATION:
If system evolves into microservices or requires third-party verification, migrate to RS256 (asymmetric signing with public/private keys).

## Response snapshot

Created `history/adr/ADR-0001-jwt-signing-strategy.md` after running the three-part
significance test (long-term impact ✅, multiple alternatives ✅, cross-cutting scope ✅) and
the over-granular / missing-alternatives flywheel checks. The ADR documents HS256 as a
**decision cluster** — algorithm + key source + library + claim set + TTL + verifier topology
+ rotation policy — rather than as an atomic single-flag choice, which keeps related concerns
that would change together (algorithm and key topology) bundled into one record.

Captured three alternatives with explicit rejection rationale and "when this becomes the right
choice" triggers for each:

- **Alternative A — RS256 (asymmetric, RSA-2048)**: rejected because the only verifier is the
  same process that holds the key. Reconsider when multiple verifier processes, third-party
  verifiers, or compliance frameworks force separation of mint/verify roles.
- **Alternative B — EdDSA (Ed25519)**: rejected on the same fundamental ground as RS256 plus
  weaker library/interop maturity in the Python+JS ecosystems.
- **Alternative C — Opaque session tokens (server-side store)**: rejected because revocation
  lists are explicitly out of scope and this would require introducing Redis/Postgres lookups
  on every request, conflicting with SC-001's latency budget.

Documented a concrete future migration path (HS256 → RS256) with a `kid`-based dual-accept
window so a future cutover doesn't log every active user out simultaneously — a real concern
because the spec leaves refresh tokens out of scope, so any disruption is felt directly.

Cross-references back to plan/research/data-model/contracts:

- Plan: `specs/002-auth-jwt-rbac/plan.md`.
- Research: research.md decisions R2 (library + algorithm), R3 (claims), R4 (TTL),
  R5 (secret hard-fail).
- Data model: `AccessToken` claim contract in §2 of `data-model.md`.
- Contracts: `bearerAuth` security scheme in `contracts/openapi.yaml`.

Two related ADR candidates flagged in `plan.md` are explicitly noted as **pending** and not
created in this run:

- Password hashing algorithm (bcrypt vs argon2) — `/sp.adr password-hashing-algorithm`.
- Ownership of the `User` entity (users vs auth) — `/sp.adr user-entity-ownership`.

Tooling notes: the project ships only a PowerShell scripts directory (`.specify/scripts/powershell/`)
and does not include a `create-adr` script. Followed the agent-native fallback: created
`history/adr/` (did not exist), allocated ID `0001`, copied the template structure from
`.specify/templates/adr-template.md`, and filled all `{{PLACEHOLDERS}}`.

## Outcome

- ✅ Impact: A reviewable record now exists for the JWT signing decision; future engineers know why HS256 was picked, what triggers a switch, and how to migrate without disrupting users.
- 🧪 Tests: none (documentation-only change).
- 📁 Files: `history/adr/ADR-0001-jwt-signing-strategy.md` (new); ADR directory bootstrapped.
- 🔁 Next prompts: `/sp.adr password-hashing-algorithm`, `/sp.adr user-entity-ownership`, then `/sp.tasks` to break the plan into executable steps.
- 🧠 Reflection: The user-supplied draft was already well-structured but covered only mint-side concerns; expanding it into a clustered decision (algorithm + key topology + library + TTL + rotation policy + verifier topology) is what makes this a real ADR rather than a one-line config note.

## Evaluation notes (flywheel)

- Failure modes observed: none. The two flywheel risks (over-granular ADR, missing alternatives) were both negative on inspection — the ADR clusters multiple related concerns into one record and lists three concrete alternatives with rationale.
- Graders run and results (PASS/FAIL):
  - "Decision clusters related changes / impacts multiple components" → PASS (algorithm, key source, library, TTL, claim set, verifier topology, rotation policy).
  - "Lists ≥1 alternative with rationale" → PASS (3 alternatives, each with rejection reason and reconsideration trigger).
  - "Pros and cons for chosen approach" → PASS (5 positives, 4 negatives).
  - "Concise but sufficient for future reference" → PASS.
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): when implementing `core/security.py`, add a single integration test that pins the JWT header to `{"alg":"HS256","typ":"JWT"}` so any accidental algorithm drift is caught at CI time, closing the loop between this ADR and the running code.
