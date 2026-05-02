---
id: 0001
title: Define auth JWT RBAC spec
stage: spec
date: 2026-05-01
surface: agent
model: claude-sonnet-4-6
feature: 002-auth-jwt-rbac
branch: 002-auth-jwt-rbac
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: [auth, jwt, rbac, security, spec]
links:
  spec: specs/002-auth-jwt-rbac/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/002-auth-jwt-rbac/spec.md
  - specs/002-auth-jwt-rbac/checklists/requirements.md
tests:
  - none (spec stage)
---

## Prompt

/sp.specify

MODULE: Authentication

PURPOSE:
Provide secure user authentication and authorization using JWT-based authentication with role-based access control (RBAC) for the SaaS system.

---

SCOPE:

This module is responsible for:
- User registration
- User login
- JWT token generation
- Authentication validation
- Role-based access enforcement

---

ROLES:

Supported roles:
- admin
- manager
- developer

Each user MUST have exactly one role.

---

FEATURES:

1. User Registration
2. User Login
3. Token Generation (JWT)
4. Token Validation
5. Role-Based Access Control

---

INPUTS:

Registration:
- name: string
- email: string
- password: string
- role: enum (admin | manager | developer)

Login:
- email: string
- password: string

---

OUTPUTS:

Registration Response:
- id
- name
- email
- role
- created_at

Login Response:
- access_token (JWT)
- token_type ("bearer")
- user:
  - id
  - name
  - email
  - role

---

DATA MODEL REQUIREMENTS:

User entity must include:
- id (primary key)
- name
- email (unique, indexed)
- password_hash
- role
- created_at (timestamp)

---

VALIDATION RULES:

- Email must be unique
- Password must be hashed before storage
- Role must be one of allowed values
- Login must fail on invalid credentials
- No plain-text passwords stored

---

JWT REQUIREMENTS:

- Must include:
  - user_id
  - email
  - role
- Must have expiration time
- Must use secure signing algorithm
- Token type: Bearer

---

AUTHORIZATION RULES:

- All protected routes require valid JWT
- Role must be extracted from token
- Access control enforced via dependencies
- Admin has full access
- Manager has limited administrative access
- Developer has restricted access

---

ERROR HANDLING:

- Invalid login → return authentication error
- Invalid token → return unauthorized error
- Missing token → deny access
- Duplicate email → reject registration

---

DEPENDENCIES:

- users module (for user data)
- core/security (JWT utilities)
- db/session (database access)

---

API ENDPOINTS:

- POST /auth/register
- POST /auth/login
- GET /auth/me (current user)

---

SECURITY CONSTRAINTS:

- Password hashing required (bcrypt)
- JWT secret must come from environment variables
- No sensitive data in responses
- Tokens must be validated on every request

---

SUCCESS CRITERIA:

- Users can register successfully
- Users can login and receive valid JWT
- Protected endpoints require valid token
- Role-based access works correctly
- Passwords are securely stored
- No authentication bypass possible

---

CONSTRAINTS:

- NO business logic outside service layer
- NO direct DB access in routes
- MUST follow modular structure:
  - model.py
  - schema.py
  - service.py
  - repository.py
  - routes.py
  - dependencies.py

---

OUTPUT EXPECTATION:

Claude Code must generate:
- SQLModel User model
- Pydantic schemas
- JWT utilities integration
- Authentication service logic
- API routes
- Dependency-based auth guards

---

FOLLOW EXISTING PROJECT STRUCTURE STRICTLY.
DO NOT CREATE NEW PATTERNS.

## Response snapshot

Created branch `002-auth-jwt-rbac` (from `main`, based at commit `0fc6ebc` post-merge of 001) and wrote `specs/002-auth-jwt-rbac/spec.md` with:

- **Four user stories**: US1 register (P1), US2 login (P1), US3 `GET /auth/me` (P1), US4 role guards (P2). US1+US2+US3 deliver MVP; US4 unlocks downstream modules.
- **22 functional requirements** (FR-001…FR-022) covering bcrypt hashing, email lowercasing & uniqueness, generic 401 on login failure (no user-enumeration leak), JWT claim shape (`sub`, `email`, `role`, `iat`, `exp`), HS256 signing from env, layer-boundary rules (User model lives in users module per FR-016, JWT logic only in `core/security` per FR-017, no direct session imports in routes per FR-018), and audit logging without secret leakage (FR-022).
- **Seven measurable success criteria** (SC-001…SC-007) including byte-identity of unknown-email vs wrong-password 401 responses (SC-005) and a grep-based audit that the auth module never imports `python-jose` directly (SC-006) or any other domain module except `users` (SC-007).
- **Edge cases**: deleted-while-logged-in user, expired-by-1s token, mixed-case email, missing JWT secret refusing boot, race-on-duplicate-email yielding 409.
- **Explicit out-of-scope list**: refresh tokens, token revocation, OAuth/SSO, MFA, password reset, rate limiting.

Validation checklist `checklists/requirements.md` written with all four sections marked complete; included a note that "implementation details" like HS256/bcrypt are reproduced as constitutional MUSTs (not design freedoms), which is why they appear in the spec text.

Zero `[NEEDS CLARIFICATION]` markers — all reasonable defaults documented in Assumptions section.

Note: PowerShell `create-new-feature.ps1` errored on positional args, but the branch was successfully created and the template was copied before the error; manual completion of the spec content followed.

## Outcome

- ✅ Impact: feature 002 spec ready for `/sp.clarify` (none expected) → `/sp.plan`. The User-model-lives-in-users-module split is decided up-front so planning won't have to relitigate it.
- 🧪 Tests: n/a at spec stage; SCs define future test surface.
- 📁 Files: 2 created (spec.md, checklists/requirements.md).
- 🔁 Next prompts: `/sp.plan` to produce technical design (research.md decision on `python-jose` vs `pyjwt`, data model owned by users module, auth/repository.py shape, dependency tree).
- 🧠 Reflection: separating "User entity owned by users module" from "auth orchestrates registration & login" early prevents the auth module from becoming a god-module and keeps the cross-module-import audit (SC-007) honest — auth importing `app.modules.users` is the only legal cross-module edge.

## Evaluation notes (flywheel)

- Failure modes observed: PS script positional-arg parser tripped over the long multi-line description; recovered by completing template content via agent-native tools.
- Graders run and results (PASS/FAIL): content-quality=PASS, requirement-completeness=PASS, feature-readiness=PASS.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): wrap calls to `create-new-feature.ps1` with a short description argument and stash the full prompt directly into the spec via the agent, side-stepping the parser entirely.
