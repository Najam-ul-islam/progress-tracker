---
id: 0004
title: Clients Management Implement
stage: green
date: 2026-05-04
surface: agent
model: claude-sonnet-4-6
feature: 004-clients-management
branch: 004-clients-management
user: Muhammad Najam Ul Islam
command: /sp.implement
labels: ["clients", "rbac", "soft-delete", "uniqueness", "tdd"]
links:
  spec: specs/004-clients-management/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - backend/app/modules/clients/model.py
  - backend/app/modules/clients/schema.py
  - backend/app/modules/clients/repository.py
  - backend/app/modules/clients/service.py
  - backend/app/modules/clients/routes.py
  - backend/alembic/versions/20260504_create_client_table.py
  - backend/scripts/audit_clients_imports.sh
  - backend/tests/conftest.py
  - backend/tests/test_clients_create.py
  - backend/tests/test_clients_read.py
  - backend/tests/test_clients_update.py
  - backend/tests/test_clients_delete.py
  - backend/tests/test_clients_uniqueness.py
  - specs/004-clients-management/tasks.md
tests:
  - backend/tests/test_clients_create.py (10 cases — admin/manager/dev × create; 401/403/409/422; lowercased email)
  - backend/tests/test_clients_read.py (9 cases — list/get-by-id × roles; 404/401/403)
  - backend/tests/test_clients_update.py (11 cases — patch × roles; empty/all-null/extra/bad-phone 422; cross-row 409; same-email no-op 200)
  - backend/tests/test_clients_delete.py (7 cases — admin 204; manager/dev 403; post-delete 404 + list-exclude; idempotent re-delete 404; 401)
  - backend/tests/test_clients_uniqueness.py (3 cases — re-use after soft delete; cross-row PATCH unchanged on 409; email casing)
  - backend/scripts/audit_clients_imports.sh (CI grep audit — PASS)
  - Full backend suite: 104 passed (auth + users + clients), 0 failed
---

## Prompt

```
/sp.implement

MODULE: Clients

OBJECTIVE:
Execute Clients module safely using uv with strict modular rules.

---

MODE:
STRICT + SAFE + UV-ONLY

---

RULES:

- DO NOT overwrite files
- DO NOT break existing modules
- USE uv for everything
- NO business logic in routes
- ALL logic in service layer

---

EXECUTION:

1. Dependencies
- Install missing:
  uv add fastapi sqlmodel

2. Model
- Create/extend Client model safely

3. Schemas
- Add only if missing

4. Repository
- DB-only functions

5. Service
- Implement:
  create, update, delete, list, get
- Enforce:
  - unique email/phone
  - RBAC

6. Routes
- Implement endpoints
- Use Depends(get_current_user)

7. Integration
- Register router in main.py (/clients)

---

VALIDATION:

Run:
uv run uvicorn app.main:app --reload

Test:
- Create client
- Duplicate → fail
- Manager CRUD → success
- Developer → denied

---

ERROR RULE:

- STOP on error
- Fix minimally
- Re-run

---

DONE IF:

- Clients CRUD works
- RBAC enforced
- App runs successfully
- No regressions

---

NEXT:
/sp.specify projects
```

## Response snapshot

Implemented the clients module per `specs/004-clients-management/tasks.md`,
filling the six-file scaffolding under `backend/app/modules/clients/` and
landing one new alembic revision plus one new CI audit script. Five HTTP
endpoints (`POST /clients`, `GET /clients`, `GET /clients/{id}`,
`PATCH /clients/{id}`, `DELETE /clients/{id}`) with RBAC
`admin = full | manager = create+read+update | developer = denied (403 on every endpoint)`.
Soft-delete via `is_active = False`; soft-deleted rows are invisible to
public reads and free their email/phone for re-use through two **partial
unique indexes** (`ix_client_email_active`, `ix_client_phone_active`) filtered
by `is_active = TRUE`. `updated_at` maintained by the application layer.
Phone format enforced by a pure-Python regex (FR-008); no `phonenumbers`
dependency added.

Workflow notes:

1. **Branch hygiene**. The current branch was `003-users-management` with a
   large amount of uncommitted users-management WIP plus the spec/tasks/PHRs
   for feature 004. Per user direction, committed only the
   users-management work on `003-users-management`
   (commit `1ab8759`), then created `004-clients-management` from there;
   the clients spec/PHRs/scaffolding travelled into the new branch as
   untracked files.
2. **Module-boundary fix**. Initial drafts of `service.py` and `routes.py`
   typed `requester` as `User` from `app.modules.users.model`. That would
   have failed `audit_clients_imports.sh` (FR-020 — clients must not import
   users). Replaced with `Any`; the principal is only used for logging
   `requester.id`, no behavioural dependency on the User type.
3. **Test-time index parity**. The migration creates the two partial unique
   indexes, but `SQLModel.metadata.create_all` (used by the test fixture)
   does not run alembic. Mirrored the indexes in the model's `__table_args__`
   using the dialect-prefixed `postgresql_where` / `sqlite_where` kwargs so
   uniqueness is enforced in tests too — without this, the duplicate-409
   tests would have silently relied on the proactive service check only.
4. **`tasks.md` checkbox restoration**. A PowerShell `-replace` to flip
   `[ ] T###` → `[X] T###` stripped the `T###` token because of capture-group
   numbering; re-inserted T001..T026 via a Python pass before declaring
   tasks complete. T027 (manual quickstart walk against a non-prod DB)
   remains unchecked per its own deferral clause; the pytest suite covers
   the in-process equivalent end-to-end.

Validation results:

- `uv run pytest tests/test_clients_*.py` → **40 passed**.
- `uv run pytest tests/` → **104 passed** (no regressions in auth/users).
- `bash scripts/audit_jose_imports.sh` → OK.
- `bash scripts/audit_auth_imports.sh` → OK.
- `bash scripts/audit_users_imports.sh` → OK.
- `bash scripts/audit_clients_imports.sh` → OK.
- App import + OpenAPI surface check → `/clients` and `/clients/{id}` both
  present.

## Outcome

- ✅ Impact: clients CRUD live behind the existing JWT/RBAC stack; admin can
  create/read/update/soft-delete; manager can create/read/update; developer
  is forbidden on every endpoint. Soft-delete + partial unique indexes
  preserve the spec's "uniqueness applies only to active rows" guarantee.
- 🧪 Tests: 40 new clients tests + 64 prior tests = 104 green; four CI grep
  audits pass.
- 📁 Files: 5 module files filled (`model/schema/repository/service/routes`),
  1 new alembic revision, 1 new audit script, 5 new test files, 1
  conftest.py edit (Client model import), 1 tasks.md checkbox sweep.
- 🔁 Next prompts: `/sp.git.commit_pr` to land the work; then
  `/sp.specify projects` to start feature 005 (the Projects module that will
  FK to `client.id`).
- 🧠 Reflection: The boundary discipline forced by `audit_clients_imports.sh`
  caught a sloppy `User` type-hint import that mypy would have happily
  accepted; the regex-vs-library phone trade-off recorded in research.md R2
  paid off — zero new dependencies, all 40 tests green.

## Evaluation notes (flywheel)

- Failure modes observed: (1) initial cross-module User import would have
  broken FR-020 — caught by mental review before running the audit; (2)
  PowerShell `-replace` capture-group bug stripped task IDs from
  `tasks.md` — recovered with a Python re-pass.
- Graders run and results (PASS/FAIL): pytest (PASS, 104/104),
  audit_jose_imports.sh (PASS), audit_auth_imports.sh (PASS),
  audit_users_imports.sh (PASS), audit_clients_imports.sh (PASS).
- Prompt variant (if applicable): n/a (single-shot /sp.implement).
- Next experiment (smallest change to try): in feature 005, declare the
  partial-unique-index pattern as a tiny shared helper so future entities
  with `is_active`-gated uniqueness don't re-derive the same `__table_args__`
  block.
