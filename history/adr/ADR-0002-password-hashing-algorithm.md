# ADR-0002: Password Hashing Algorithm

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together.

- **Status:** Accepted
- **Date:** 2026-05-02
- **Feature:** 002-auth-jwt-rbac
- **Context:** The progress-tracker SaaS backend (FastAPI + SQLModel modular monolith at
  `backend/app/`) needs to store user credentials for the new auth feature. Passwords arrive on
  `POST /auth/register`, are persisted in the `user.password_hash` column owned by the `users`
  module, and are verified on `POST /auth/login`. The chosen algorithm permanently shapes the
  on-disk format of every credential row — migrating later requires an opportunistic re-hash on
  successful login (or a forced password reset). The decision must balance security strength,
  operational simplicity, ecosystem fit with FastAPI, and the latency budget defined by SC-001
  (register / login round-trip < 1 s).

<!-- Significance checklist (all true):
     1) Impact: the hash format is durable on-disk state. Switching algorithm later forces an
        opportunistic re-hash-on-login migration AND a `passlib.CryptContext(deprecated="auto")`
        rollout; this is not a swap-a-library change.
     2) Alternatives: argon2 (also already in pyproject.toml), plain SHA-256/512 with manual salt,
        and PBKDF2 are all viable with real tradeoffs.
     3) Scope: cross-cutting — every authenticated request path depends on this primitive, and
        the column shape is referenced by the users module, the auth service, and the test suite. -->

## Decision

Adopt **bcrypt via passlib (`passlib[bcrypt]`)** as the password hashing algorithm for the auth
feature, including the following components:

- **Algorithm**: bcrypt (`$2b$` variant), cost factor 12 (passlib default).
- **Library**: `passlib[bcrypt]` (already declared in `backend/pyproject.toml`). No other module
  imports `passlib` or `bcrypt` directly.
- **Encoding/decoding entrypoints**: `app/core/security.py::hash_password` and
  `app/core/security.py::verify_password`. The `auth/service.py` layer is the only caller on the
  write path (`register_user`) and on the verify path (`authenticate_user`).
- **Storage**: `user.password_hash: str` column owned by the `users` module SQLModel, populated
  exclusively via the security helpers above.
- **Cost-factor policy**: keep the passlib default (12) for now; if benchmarking on the target
  prod hardware shows the hash dominates the < 1 s SC-001 budget, lower the cost via a
  `Settings.BCRYPT_COST` knob rather than hard-coding it.
- **Forward-compat hook**: future migration to a stronger algorithm will be done through a
  `passlib.CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")` so that legacy bcrypt
  hashes continue to verify and are silently re-hashed on the user's next successful login.

## Consequences

### Positive

- **Secure password storage**: bcrypt is industry standard, has a built-in per-row salt, and a
  tunable adaptive cost factor — exactly the three properties a password hash must have.
- **Simple and reliable implementation**: passlib gives a one-line `hash_password` /
  `verify_password` API; no manual salt management, no custom KDF wiring.
- **Well-supported ecosystem**: passlib + bcrypt is the de-facto pairing for FastAPI tutorials,
  Stack Overflow answers, and the official FastAPI security docs — onboarding cost is near zero.
- **Already in the dependency tree**: zero net change to `pyproject.toml` for this decision; uv
  lockfile stays clean.
- **Smooth future migration path**: passlib's `CryptContext(deprecated="auto")` makes the
  bcrypt → argon2 transition a config-only change at the verify boundary, with opportunistic
  re-hashing on login. No big-bang migration is required.

### Negative

- **Slower than basic hashing (by design)**: cost factor 12 ⇒ ~250 ms per hash on commodity
  hardware. This is intentional (it is what makes the hash expensive to brute-force) but means
  registration and login each spend ~250 ms in bcrypt on top of the DB round-trip.
- **Less memory-hard than argon2**: bcrypt is CPU-hard but not significantly memory-hard;
  GPU/ASIC attackers gain more leverage against bcrypt than against argon2id at equivalent CPU
  cost. The 12-round cost is the mitigation today.
- **72-byte input cap**: bcrypt silently truncates passwords beyond 72 bytes. This is a known
  bcrypt quirk; it is not a problem at the spec's password policy level (8–64 chars in the
  user-visible policy), but it is a footgun if the policy ever raises the limit without
  pre-hashing the input through SHA-256.
- **Single-algorithm lock-in for current rows**: any row written today is a `$2b$…` hash. A
  future algorithm change requires the opportunistic re-hash strategy above; users who never log
  in again keep their bcrypt hash forever.

## Alternatives Considered

### Alternative A — argon2 (argon2-cffi via passlib)

- **Shape**: the 2015 PHC password-hashing competition winner. Provides argon2id with explicit
  memory cost, time cost, and parallelism parameters.
- **Why rejected (today)**: stronger on paper (memory-hardness defeats commodity GPU farms more
  effectively than bcrypt) but the spec explicitly mandates bcrypt and acceptance tests assert
  the `$2b$` hash prefix. Also, argon2 parameter tuning is more nuanced — wrong parameters can
  either be insecure (too low) or DoS-prone (too high). bcrypt's single cost knob is harder to
  misuse.
- **When this becomes the right choice**: if compliance (e.g., a regulated-industry customer)
  demands a memory-hard KDF, or if real-world attacker-economics shift such that bcrypt-12 no
  longer meets the security bar. The migration path is already designed in via passlib's
  `deprecated="auto"` mechanism.

### Alternative B — Plain SHA-256 / SHA-512 with a manual salt

- **Shape**: hash the password with a per-user random salt using a fast cryptographic hash.
- **Why rejected**: no tunable work factor, GPU-friendly, and the engineer would have to
  hand-roll salt generation, storage, and constant-time comparison. Every one of these is a
  well-documented footgun. Modern guidance (OWASP ASVS, NIST SP 800-63B) explicitly recommends
  *against* bare hashes for passwords.
- **When this becomes the right choice**: never, for password storage.

### Alternative C — PBKDF2-HMAC-SHA256

- **Shape**: also tunable-iteration key derivation function; supported by passlib and by the
  Python stdlib (`hashlib.pbkdf2_hmac`).
- **Why rejected**: comparable to bcrypt in age and battle-testing, but the bcrypt + passlib
  pairing is already the project's stated direction (per spec FR-007 and research R1) and PBKDF2
  is more vulnerable to GPU acceleration than bcrypt at equivalent cost. No reason to deviate.
- **When this becomes the right choice**: regulated-industry deployment that requires a
  FIPS-140-validated primitive (PBKDF2-HMAC-SHA256 has FIPS validation pathways that bcrypt
  does not).

## Future migration path (bcrypt → argon2)

When the migration trigger fires (compliance, attacker-economics shift, or routine algorithm
refresh), the smallest-viable-change rollout is:

1. Replace the single-scheme passlib helper with
   `CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")` in `app/core/security.py`.
2. New writes (`register_user`, password resets) produce `$argon2id$…` hashes.
3. Existing bcrypt hashes continue to verify; passlib reports them as deprecated and the auth
   service silently re-hashes on the next successful login of each user.
4. Once a chosen tail of users has migrated (or after a deadline), force a password reset for
   the remainder and drop bcrypt from the `schemes` list.

This staged approach matters because there is no bulk-rehash path for existing rows — the only
moment we hold the plaintext password is at login.

## References

- Feature Spec: [`specs/002-auth-jwt-rbac/spec.md`](../../specs/002-auth-jwt-rbac/spec.md)
- Implementation Plan: [`specs/002-auth-jwt-rbac/plan.md`](../../specs/002-auth-jwt-rbac/plan.md)
- Research (R1 — Password hashing algorithm):
  [`specs/002-auth-jwt-rbac/research.md`](../../specs/002-auth-jwt-rbac/research.md)
- Data Model (`User.password_hash` column shape):
  [`specs/002-auth-jwt-rbac/data-model.md`](../../specs/002-auth-jwt-rbac/data-model.md)
- Related ADRs:
  - [`ADR-0001`](./ADR-0001-jwt-signing-strategy.md) — JWT signing strategy (the other half of
    the auth security primitives).
  - User entity ownership (users module vs auth module) — pending
    `/sp.adr user-entity-ownership`.
- Evaluator Evidence: PHR `history/prompts/002-auth-jwt-rbac/<this-run>.misc.prompt.md`
