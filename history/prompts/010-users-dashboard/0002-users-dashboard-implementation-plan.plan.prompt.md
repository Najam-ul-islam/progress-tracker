---
id: 0002
title: Users dashboard implementation plan
stage: plan
date: 2026-05-12
surface: agent
model: claude-sonnet-4-6
feature: 010-users-dashboard
branch: 010-users-dashboard
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: [plan, frontend, users, dashboard, rbac, tanstack-query, rhf, zod]
links:
  spec: specs/010-users-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/010-users-dashboard/plan.md
  - specs/010-users-dashboard/research.md
  - specs/010-users-dashboard/data-model.md
  - specs/010-users-dashboard/contracts/users-client.md
  - specs/010-users-dashboard/contracts/rbac-matrix.md
  - specs/010-users-dashboard/quickstart.md
tests: []
---

## Prompt

/sp.plan
1. Users table UI
2. User profile page
3. Edit/update forms
4. API integration
5. RBAC UI handling

## Response snapshot

Authored the full Phase 0 + Phase 1 plan for `010-users-dashboard` on top of the deployed `003-users-management` backend and the merged `009-auth-ui` foundation.

- **plan.md**: Summary, Technical Context (TS 6 / React 19 / TanStack Query v5 / RHF / Zod / Zustand / shadcn; new dep `@radix-ui/react-dialog`), Constitution Check **PASS** on all five core principles and all nine frontend hard-constraints, full module file tree under `frontend/src/modules/users/{pages,components,hooks,services,schemas}` (no `store/`), testing strategy table, agent-context update skipped (no new stack-level tech), and a clean Re-check Constitution Check PASS after design.
- **research.md**: Eight decisions, each bound to FRs from the spec — (1) single-fetch + client filter, (2) URL search params for filter state, (3) Radix Dialog + RHF + Zod, (4) surgical cache invalidation on mutation, (5) DOM-absent affordances via `<IfRole>`/`<RequireUsersAccess>`, (6) wire↔domain rename adapter inside `users.api.ts`, (7) backend-owned self-edit guard surfaced inline, (8) three first-class state components (Empty, Error, Skeleton).
- **data-model.md**: Domain types (`User`, `Role`, `Status`, `UsersFilter`, `EditDraft`, `DeveloperMetadata`), wire types kept private to the service, validation table, edit-modal and list/profile state machines, TanStack Query cache-key conventions.
- **contracts/users-client.md**: Function-level contract for `usersApi.{list,get,update,updateStatus}` including `UsersApiError` taxonomy (`unauthorized | forbidden | not_found | conflict | validation | network | unknown`), per-method error-to-UI mapping table, and query-key conventions.
- **contracts/rbac-matrix.md**: Role × surface × affordance grid covering nav link, `/users`, `/users/<id>`, modal, and session edge cases — every cell tagged with the FR it satisfies; ties to the three predicates in `lib/rbac.ts`.
- **quickstart.md**: Local run instructions and a 7-step manual verification walk-through against the running backend.

Recovered from prior-session blocker: empty `plan.md` template (created by `setup-plan.ps1`) required Read-before-Write — performed the Read and wrote the full plan content.

## Outcome

- ✅ Impact: Plan + 4 design artifacts ready. Constitution gates PASS pre- and post-design. Zero backend changes. Ready for `/sp.tasks`.
- 🧪 Tests: n/a at the plan stage.
- 📁 Files: 6 created — plan.md, research.md, data-model.md, contracts/users-client.md, contracts/rbac-matrix.md, quickstart.md.
- 🔁 Next prompts: `/sp.tasks` to generate the executable task list; `/sp.adr` only if a future debate (e.g. server-side pagination vs client-side) becomes contentious.
- 🧠 Reflection: The largest design call was choosing DOM-absent affordances (`<IfRole>`) over disabled buttons. Spec FR-024 was unambiguous, but it's the kind of constraint that drifts in implementation if it's not pinned in the contract layer — the rbac-matrix.md document is now the single source of truth that test cases and components can both cite.

## Evaluation notes (flywheel)

- Failure modes observed: none. Prior session's Read-before-Write violation was already understood; no new blockers.
- Graders run and results (PASS/FAIL): Constitution Check PASS (pre- and post-design); spec → plan traceability PASS (every FR maps to at least one decision or contract row); no NEEDS CLARIFICATION introduced.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): teach `setup-plan.ps1` to emit `research.md` / `data-model.md` / `contracts/` / `quickstart.md` as empty templates alongside `plan.md`, so the agent doesn't need to remember the four-file list.
