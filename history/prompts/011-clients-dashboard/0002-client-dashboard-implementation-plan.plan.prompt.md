---
id: 0002
title: Client Dashboard Implementation Plan
stage: plan
date: 2026-06-13
surface: agent
model: claude-opus-4-8[1m]
feature: 011-clients-dashboard
branch: 011-clients-dashboard
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["clients", "frontend", "plan", "react-query", "rbac", "crud"]
links:
  spec: specs/011-clients-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/011-clients-dashboard/plan.md
 - specs/011-clients-dashboard/research.md
 - specs/011-clients-dashboard/data-model.md
 - specs/011-clients-dashboard/contracts/clients-frontend-contract.md
 - specs/011-clients-dashboard/quickstart.md
 - CLAUDE.md
tests:
 - none (planning stage; test strategy defined for /sp.tasks to implement)
---

## Prompt

1. Clients dashboard
2. CRUD forms
3. Table integration
4. API integration
5. Validation/testing

## Response snapshot

Ran `setup-plan.ps1`, loaded the spec + constitution, and inspected the live `frontend/` codebase — confirming the shipped `010-users-dashboard` module is a near-exact template for this feature. Read its api/hooks/types/schemas/dialog/pages/RBAC/routing/test files to ground every decision in real conventions.

Produced all Phase 0/1 artifacts on branch `011-clients-dashboard`:

- **plan.md** — Summary, Technical Context (TS 6/React 19, React Query 5, RHF+Zod 4, Axios, Zustand, Tailwind 4, shadcn, MSW/Vitest), a Constitution Check table (PASS, no violations), and a concrete source tree for the new `modules/clients/` module + `frontend/tests/` additions. The five user-input themes map to phases: dashboard, CRUD forms, table integration, API integration, validation/testing.
- **research.md** — 9 decisions: reuse users-module architecture; wire/error mapping with 409 field-attribution by inspecting the conflict message; a single dual-mode `ClientFormDialog` (create+edit) with no-op-PATCH guard; Zod validation copying the backend's exact phone regex; React Query cache strategy (invalidate list on create, setQueryData+invalidate on update, removeQueries on delete so deleted detail → 404); 3-layer RBAC with DOM-absent affordances (admin+manager CRU, admin-only D, developer none, no self-view); routing reuse; contact-info cards; MSW test approach. Resolved-unknowns table.
- **data-model.md** — wire vs camelCase domain `Client`, form/draft shapes, URL-backed `ClientsFilter { q }`, Zod rules aligned to the backend contract, `ClientsApiError` taxonomy, query keys + cache effects.
- **contracts/clients-frontend-contract.md** — frontend consumption contract per endpoint (no new endpoints; consumes the stable `004` REST contract), RBAC table, error→UI map, and 6 contract-test obligations.
- **quickstart.md** — run/dev/test instructions, route table, per-user-story manual verification, Definition of Done.

Ran `update-agent-context.ps1 -AgentType claude` (updated CLAUDE.md with the frontend stack). Re-checked the Constitution gate post-design: still PASS — the design copies the constitution-compliant users module file-for-file in shape and is purely additive (Principle IV). Verified no unresolved template placeholders remain.

Key clients-vs-users divergences captured: full CRUD (create + delete are new), editable email/phone with 409 duplicate handling, admin-only delete behind a confirmation, and zero developer access (no ownership carve-out).

## Outcome

- ✅ Impact: Complete, constitution-compliant implementation plan and design artifacts for feature 011; ready for `/sp.tasks`.
- 🧪 Tests: none run (plan stage); defined a 6-category MSW/Vitest test strategy mapping to constitution Testing Standards.
- 📁 Files: plan.md, research.md, data-model.md, contracts/clients-frontend-contract.md, quickstart.md created; CLAUDE.md updated by agent-context script.
- 🔁 Next prompts: `/sp.tasks` to generate the dependency-ordered task list; optional `/sp.adr` if a decision is deemed significant (none rose to that bar — this mirrors an existing module).
- 🧠 Reflection: Grounding the plan in the actual users-module source (not assumptions) kept it precise; the only genuine design extension over the precedent is the dual-mode create/edit dialog and the delete flow.

## Evaluation notes (flywheel)

- Failure modes observed: Bash tool cwd reset between calls (relative `cd frontend` failed once); switched to absolute paths under `/d/progress-tracker`.
- Graders run and results (PASS/FAIL): Constitution Check — PASS (pre- and post-design); placeholder scan — PASS (none unresolved).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): During `/sp.tasks`, sequence the dual-mode dialog as create-first then extend to edit, to keep each task independently testable.
