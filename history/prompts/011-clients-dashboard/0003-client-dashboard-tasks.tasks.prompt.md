---
id: 0003
title: Client Dashboard Task Breakdown
stage: tasks
date: 2026-06-13
surface: agent
model: claude-opus-4-8[1m]
feature: 011-clients-dashboard
branch: 011-clients-dashboard
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["clients", "frontend", "tasks", "crud", "rbac", "testing"]
links:
  spec: specs/011-clients-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/011-clients-dashboard/tasks.md
tests:
 - none run (task-planning stage; test tasks T008–T012, T023, T028–T029, T034–T035, T040, T045–T047 defined for implementation)
---

## Prompt

1. Create a client's page
2. Create client forms
3. Add tables/cards
4. Integrate APIs
5. Add loading/error states

## Response snapshot

Ran `check-prerequisites.ps1` (confirmed all design docs present: research, data-model, contracts/, quickstart) and read the tasks template. Generated `specs/011-clients-dashboard/tasks.md` with **53 tasks** organized by the six spec user stories, with test tasks INCLUDED (constitution Testing Standards mandate them; plan defines the MSW/Vitest strategy).

Structure:
- **Phase 1 Setup** (T001–T002): module skeleton + green-baseline check.
- **Phase 2 Foundational** (T003–T009): types/`ClientsApiError`, RBAC helpers (canView/canEdit admin+manager, canDelete admin-only), `clients.api.ts` (wire mappers + error taxonomy + query keys), MSW handlers + server registration, api/RBAC unit tests. Blocks all stories.
- **Phase 3 US1** (T010–T022, MVP): list page + client-side search + RequireClientsAccess + table + nav link + loading/empty/error states.
- **Phase 4 US2** (T023–T027): details page + ContactInfoCards + useClient + `/clients/:id` route.
- **Phase 5 US3** (T028–T033): client-form Zod schema (phone regex copied from backend), useCreateClient, ClientFormDialog (create mode), New-client CTA.
- **Phase 6 US4** (T034–T039): useUpdateClient, extend ClientFormDialog to edit mode (diffDraft, no-op guard), Edit affordances on details + rows.
- **Phase 7 US5** (T040–T044): useDeleteClient (removeQueries on success), DeleteClientDialog confirmation, admin-only wiring on details + rows.
- **Phase 8 US6** (T045–T048): RBAC component tests (nav, gate, session-expiry) + affordance-gating audit.
- **Phase 9 Polish** (T049–T053): a11y, responsive, typecheck/lint, full test run, quickstart DoD.

Every task uses the required checklist format (`- [ ] Txxx [P?] [USx?] description + file path`). Included dependency graph, per-story parallel opportunities, a US1 parallel example, and MVP/incremental/parallel-team strategies. The five user-input themes map across phases: page→US1/US2, forms→US3/US4, tables/cards→US1/US2, APIs→Foundational+hooks, loading/error states→woven through every story + Polish. Key design note enforced in tasks: the shared `ClientFormDialog` is built once in US3 and extended in US4 (no duplication).

## Outcome

- ✅ Impact: 53 dependency-ordered, independently-testable tasks ready for `/sp.implement`; MVP = Setup+Foundational+US1.
- 🧪 Tests: none executed; 13 test tasks specified (unit: api, rbac, filter, filter-schema, form-schema; component: list, details, form-dialog, delete-dialog, header, gate, session-expiry).
- 📁 Files: specs/011-clients-dashboard/tasks.md created.
- 🔁 Next prompts: `/sp.implement` to execute, starting at Phase 1; optional `/sp.analyze` for cross-artifact consistency check first.
- 🧠 Reflection: Mapping the dual-mode dialog as US3-create-then-US4-extend keeps each story independently testable while avoiding duplicate dialog code — the one real divergence from the users-module precedent.

## Evaluation notes (flywheel)

- Failure modes observed: none this step; prerequisites and template loaded cleanly.
- Graders run and results (PASS/FAIL): checklist-format self-check — PASS (all 53 tasks have checkbox+ID+path; story labels only on US phases); story-coverage check — PASS (each of US1–US6 has tests + implementation + checkpoint).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): During `/sp.implement`, after Foundational, validate US1 in isolation before starting US2–US5 to confirm the MVP slice truly stands alone.
