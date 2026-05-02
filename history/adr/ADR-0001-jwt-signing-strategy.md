# ADR-0001: JWT Signing Strategy

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together.

- **Status:** Accepted
- **Date:** 2026-05-02
- **Feature:** 002-auth-jwt-rbac
- **Context:** The progress-tracker SaaS backend is a single FastAPI modular monolith
  (`backend/app/`) that owns both the JWT minting path (`POST /auth/login`) and every JWT
  verification path (`get_current_user` dependency, role guards). The system needs an
  authentication token format that is secure, simple to operate, and a clean fit for a
  single-process verifier today, while leaving a defensible migration path if the system
  later splits into independently-deployed services or admits third-party verifiers.

<!-- Significance checklist (all true):
     1) Impact: token format and key topology are long-term commitments — changing later
        forces a key-rotation migration AND a re-deploy of every verifier.
     2) Alternatives: HS256 vs RS256 vs EdDSA all viable, with real tradeoffs.
     3) Scope: every protected endpoint in every module decodes these tokens. Cross-cutting. -->

## Decision

Adopt **HS256 (HMAC-SHA256, symmetric signing)** as the JWT signing strategy for the auth
feature, including the following components:

- **Algorithm**: HS256 (`Settings.JWT_ALGORITHM = "HS256"`).
- **Key**: a single shared secret loaded from the `JWT_SECRET_KEY` environment variable via
  `app/core/config.py::Settings`. No default value — the application refuses to start if the
  variable is missing or empty.
- **Library**: `python-jose[cryptography]` (already declared in `backend/pyproject.toml`).
- **Encoding/decoding entrypoints**: `app/core/security.py::create_access_token` and
  `app/core/security.py::decode_access_token`. No other module is permitted to import
  `python-jose` directly (enforced by spec FR-017 / SC-006).
- **Claim set**: `sub` (user id as string), `email`, `role`, `iat`, `exp`. Strict expiration
  check (no leeway).
- **Token TTL**: `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, default 60 minutes, configurable per
  environment via `.env`.
- **Verifier topology**: single in-process verifier (the FastAPI app itself). The shared
  secret never leaves the API host.
- **Key-rotation policy (today)**: rotate by replacing `JWT_SECRET_KEY` and accepting the
  one-time consequence that all live tokens become invalid. No multi-key acceptance window in
  this iteration.

## Consequences

### Positive

- **Minimal operational complexity**: one secret to provision, one secret to rotate, no
  public-key distribution and no JWKS endpoint to host.
- **Faster development and faster verification path**: HMAC is significantly cheaper than
  RSA signature verification on the hot path; this matters because every protected request
  decodes a token.
- **Tight integration with FastAPI tooling**: `python-jose[cryptography]` and
  `OAuth2PasswordBearer` work out of the box, so Swagger UI's "Authorize" flow is free.
- **Clean security story for the current architecture**: because the API is the only verifier,
  the symmetry of the key is not a leak — there is no third party that needs to verify without
  also being able to mint.
- **Smaller token surface**: no `kid` rotation header to manage today, no JWKS caching layer
  to debug.

### Negative

- **Not suitable as-is for multi-service architectures**: any future service that needs to
  verify tokens would have to be entrusted with the minting secret, which violates least
  privilege. Splitting verification across services later requires migrating to an asymmetric
  algorithm.
- **Key compromise = total compromise**: a leaked `JWT_SECRET_KEY` lets an attacker mint
  arbitrary tokens. The mitigation is operational (secret manager, restricted access, rotation
  drill); there is no cryptographic separation of duties.
- **No revocation list**: combined with HS256, this means a stolen token is valid until its
  `exp`. The 60-minute TTL bounds the blast radius. A revocation list / refresh token model
  is explicitly out of scope for the current feature (per spec).
- **Rotation is disruptive today**: rotating the secret invalidates every live session in one
  step. A multi-key acceptance window (`primary` + `previous`) is a deliberate non-goal in
  this iteration; the team accepts the disruption in exchange for simpler code.

## Alternatives Considered

### Alternative A — RS256 (asymmetric, RSA-2048)

- **Shape**: private key signs in the API, public key verifies anywhere. Public key would be
  served via a JWKS endpoint or distributed as a static file.
- **Why rejected (today)**: the only verifier is the same process that holds the private key,
  so the asymmetry buys nothing concrete right now. It costs more — bigger tokens, slower
  per-request verification, additional ops surface (key generation, JWKS endpoint, key-id
  rotation header), and an extra failure mode (JWKS cache staleness on rotation).
- **When this becomes the right choice**: any of the following triggers reconsideration —
  (1) the system splits into multiple verifier processes that should not be able to mint;
  (2) third-party clients need to verify our tokens; (3) compliance frameworks demand
  cryptographic separation between minter and verifier roles.

### Alternative B — EdDSA (Ed25519)

- **Shape**: also asymmetric, but uses elliptic-curve signatures with smaller keys / smaller
  signatures than RSA.
- **Why rejected (today)**: same fundamental rationale as RS256 — asymmetric signing is
  unnecessary while there is one verifier — plus library support across the Python and JS
  ecosystems is less mature than HS256/RS256, which would slow the team down and risk subtle
  interop bugs at the verification boundary.
- **When this becomes the right choice**: if the migration trigger fires (see RS256 above) and
  the team wants smaller tokens than RSA-2048 produces.

### Alternative C — Opaque session tokens with a server-side store

- **Shape**: instead of self-contained JWTs, mint random opaque tokens and look them up in
  Redis / Postgres on every request.
- **Why rejected**: spec lists "token revocation lists, session blacklists" as out of scope,
  and the system has no Redis dependency today. Opaque tokens trade the JWT's
  no-DB-call-on-verify property for a per-request DB call, which conflicts with SC-001's
  performance budget and adds infrastructure that is not yet in the project.
- **When this becomes the right choice**: if revocation becomes a hard requirement (e.g., the
  product needs an explicit "log out everywhere" button or a security-incident kill switch
  for an individual user) and the latency cost of a session lookup is acceptable.

## Future migration path (HS256 → RS256)

When the migration triggers fire, the smallest-viable-change rollout is:

1. Generate a new RSA keypair; store the private key in the secret manager, publish the public
   key (file or JWKS endpoint).
2. Add a `kid` (key id) header to newly-minted tokens. Verifier accepts `HS256` (legacy) **or**
   `RS256` (new) for one full token-TTL window.
3. Flip the minter to RS256.
4. After the TTL window closes, drop HS256 acceptance.

This staged approach matters because the project has no refresh tokens — a hard cutover would
log every active user out simultaneously.

## References

- Feature Spec: [`specs/002-auth-jwt-rbac/spec.md`](../../specs/002-auth-jwt-rbac/spec.md)
- Implementation Plan: [`specs/002-auth-jwt-rbac/plan.md`](../../specs/002-auth-jwt-rbac/plan.md)
- Research (R2 — JWT library and signing algorithm; R3 — claims; R4 — TTL; R5 — secret hard-fail):
  [`specs/002-auth-jwt-rbac/research.md`](../../specs/002-auth-jwt-rbac/research.md)
- Data Model (`AccessToken` claim contract):
  [`specs/002-auth-jwt-rbac/data-model.md`](../../specs/002-auth-jwt-rbac/data-model.md)
- HTTP Contract (token shape on `/auth/login`):
  [`specs/002-auth-jwt-rbac/contracts/openapi.yaml`](../../specs/002-auth-jwt-rbac/contracts/openapi.yaml)
- Related ADRs: none yet. Two further candidates were flagged in `plan.md` but are not yet
  documented:
  - Password hashing algorithm (bcrypt vs argon2) — pending `/sp.adr password-hashing-algorithm`.
  - Ownership of the `User` entity (users module vs auth module) — pending
    `/sp.adr user-entity-ownership`.
- Evaluator Evidence: PHR `history/prompts/002-auth-jwt-rbac/0003-jwt-signing-strategy-adr.misc.prompt.md`
