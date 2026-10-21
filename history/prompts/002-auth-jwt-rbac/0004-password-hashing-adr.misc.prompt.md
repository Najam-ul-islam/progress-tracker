---
id: 0004
title: Password Hashing ADR
stage: misc
date: 2026-05-02
surface: agent
model: claude-sonnet-4-6
feature: 002-auth-jwt-rbac
branch: 002-auth-jwt-rbac
user: Muhammad Najam Ul Islam
command: /sp.adr
labels: [adr, auth, security, password-hashing, bcrypt]
links:
  spec: specs/002-auth-jwt-rbac/spec.md
  ticket: null
  adr: history/adr/ADR-0002-password-hashing-algorithm.md
  pr: null
files:
  - history/adr/ADR-0002-password-hashing-algorithm.md
  - history/prompts/002-auth-jwt-rbac/0004-password-hashing-adr.misc.prompt.md
tests:
  - none (documentation-only change)
---

## Prompt

/sp.adr

TITLE: Password Hashing Algorithm

STATUS: Accepted

CONTEXT:
The system requires secure password storage for user authentication in a FastAPI + SQLModel SaaS backend.

DECISION:
Use bcrypt via passlib for password hashing.

RATIONALE:
- Industry standard and widely trusted
- Built-in salting and adaptive cost factor
- Easy integration with FastAPI
- Strong balance of security and performance

CONSEQUENCES:

Positive:
- Secure password storage
- Simple and reliable implementation
- Well-supported ecosystem

Negative:
- Slower than basic hashing (by design)
- Less memory-hard compared to Argon2

FUTURE CONSIDERATION:
Upgrade to Argon2 if higher security or compliance requirements arise.

## Response snapshot

Created ADR-0002 (`history/adr/ADR-0002-password-hashing-algorithm.md`) capturing the bcrypt-via-passlib
decision as the second auth-feature ADR (companion to ADR-0001 JWT signing strategy). The ADR
expands on the user's input by:

- Clustering the decision (algorithm + library + entrypoints + storage column + cost-factor knob
  + forward-compat hook through `passlib.CryptContext(deprecated="auto")`).
- Adding three rejected alternatives with rationale: argon2 (passlib), plain SHA-256/512 with
  manual salt, and PBKDF2-HMAC-SHA256.
- Documenting a staged bcrypt → argon2 migration path because there is no bulk-rehash path —
  only opportunistic re-hash on next successful login.
- Calling out the bcrypt 72-byte input cap as a known footgun.

The other two ADR candidates flagged in `plan.md` were not actioned in this exchange:
JWT signing strategy is already documented as ADR-0001; user-entity-ownership is still pending.

## Outcome

- ✅ Impact: One new ADR file created (ADR-0002). No code or schema changes. Plan/spec untouched.
- 🧪 Tests: none (documentation-only change).
- 📁 Files: `history/adr/ADR-0002-password-hashing-algorithm.md`, this PHR.
- 🔁 Next prompts: optionally `/sp.adr user-entity-ownership` for the third pending candidate;
  then `/sp.tasks` to convert the plan into an executable tasks.md.
- 🧠 Reflection: User input gave the skeleton (status, context, decision, rationale, consequences,
  future consideration). The ADR adds the missing alternatives and migration path required by
  the significance checklist; without those, the ADR would have failed the "list at least one
  alternative" grader.

## Evaluation notes (flywheel)

- Failure modes observed: none. Initial draft already clusters the decision (algorithm + library
  + entrypoints + storage + cost knob + forward-compat hook) rather than documenting a single
  atomic choice; alternatives section enumerates three named alternatives with rejection
  reasoning.
- Graders run and results (PASS/FAIL):
  - Decision is clustered (not atomic): PASS
  - At least one alternative listed with rationale: PASS (three alternatives)
  - Pros and cons present for chosen approach and alternatives: PASS
  - Concise but sufficiently detailed: PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): if the user later actions
  `/sp.adr user-entity-ownership`, reuse the same alternatives-must-be-named structure to keep
  the three auth-feature ADRs symmetrical.
