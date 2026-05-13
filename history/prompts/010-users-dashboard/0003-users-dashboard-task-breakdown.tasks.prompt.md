---
id: 0003
title: Users dashboard task breakdown
stage: tasks
date: 2026-05-12
surface: agent
model: claude-sonnet-4-6
feature: 010-users-dashboard
branch: 010-users-dashboard
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: [tasks, frontend, users, dashboard, rbac, vitest, msw]
links:
  spec: specs/010-users-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/010-users-dashboard/tasks.md
tests: []
---

## Prompt

/sp.tasks
1. Create users page
2. Create profile page
3. Add table + pagination
4. Add edit dialogs/forms
5. Integrate APIs
6. Add loading states

## Response snapshot

Generated `specs/010-users-dashboard/tasks.md` — 56 tasks (T001–T056) organized strictly by user story, every task in the mandated `- [ ] [TaskID] [P?] [Story?] description + file path` format.

Pre-step: `check-prerequisites.ps1` reported `AVAILABLE_DOCS: []` because plan/research/data-model/contracts/quickstart did not yet exist. Backfilled all five documents first (see PHR 0002), then generated tasks.

Breakdown:

- **Phase 1 Setup (T001–T008, 8 tasks)**: module dir scaffold; `@radix-ui/react-dialog` install; 5 new shadcn primitives (`badge`, `dialog`, `skeleton`, `table`, `select`); `types.ts`.
- **Phase 2 Foundational (T009–T017, 9 tasks)**: `lib/rbac.ts` + tests; `users.api.ts` + tests + MSW handlers; `<IfRole>` / `<IfAdmin>` / `<RequireUsersAccess>` boundaries; shared `<EmptyState>` and `<ErrorState>`.
- **Phase 3 US1 list (T018–T031, 14 tasks) — MVP**: 5 test files first (filter schema, useFilteredUsers, UsersListPage, RoleBadge, IfRole), then schemas → hooks → leaf components → page → route wiring.
- **Phase 4 US2 profile (T032–T036, 5 tasks)**: UserProfilePage test; `useUser`, `UserProfileCard`, page, route.
- **Phase 5 US3 edit modal (T037–T044, 8 tasks)**: editUserSchema test + EditUserDialog test; schema, two mutation hooks, dialog, mount points on profile and list.
- **Phase 6 US4 RBAC chrome (T045–T051, 7 tasks)**: AppHeader nav-link test, RequireUsersAccess test, session-expiry redirect regression test, cross-tab role-change test; "Users" link in AppHeader behind `<IfRole>`; two "verify-existing-behavior" regression tasks for 401-with-`from` and cross-tab sync.
- **Phase 7 Polish (T052–T056, 5 tasks)**: a11y audit, typecheck, full test run, manual quickstart walk-through, module README note.

Cross-story dependencies surfaced explicitly: US3 depends on US2 (T043) and US1 (T044); US4 depends on US1 for AppHeader test (T049). 35 of 56 tasks marked `[P]`.

User input acknowledged: the six numbered hints ("Create users page", "Create profile page", "Add table + pagination", "Add edit dialogs/forms", "Integrate APIs", "Add loading states") map cleanly to US1–US3 and the Setup/Foundational tasks. **"Pagination" deliberately omitted** — the spec's Out-of-Scope section pins server-side pagination as a follow-up feature, and the Assumptions section commits to low-hundreds of users; honored the spec over the slash-command hint, documented under Phase 1 (no pagination task).

## Outcome

- ✅ Impact: 56 immediately-executable tasks; every one has a concrete file path. MVP scope is Phase 1 + 2 + 3 (US1, list). Ready for `/sp.implement`.
- 🧪 Tests: n/a at the tasks stage; tests are listed in each story phase to be written-first.
- 📁 Files: 1 created — `specs/010-users-dashboard/tasks.md`. (Plan-phase files from PHR 0002 also landed in this turn because prerequisites were missing.)
- 🔁 Next prompts: `/sp.implement` once approved; ask the user whether to scope to MVP-only (Phase 1+2+3) or full (Phases 1–7) as we did for `009-auth-ui`.
- 🧠 Reflection: The hint mentioned "pagination" but the spec rules it out-of-scope. Resisting the urge to add a task that contradicts the spec is the kind of small discipline that keeps the spec → tasks chain trustworthy. Pinned the reasoning in this PHR so future me sees why pagination is absent.

## Evaluation notes (flywheel)

- Failure modes observed: prerequisites missing (plan + research + data-model + contracts + quickstart all absent). Recovered by backfilling all five documents before generating tasks. Root cause: prior session was compacted mid-`/sp.plan` and the artifacts were never written.
- Graders run and results (PASS/FAIL): format-check PASS (every task has checkbox + ID + optional [P] + story label where applicable + file path); spec → tasks traceability PASS (every FR maps to at least one task); each user story has an Independent Test paragraph and at least one component test.
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): wire `check-prerequisites.ps1` to surface AVAILABLE_DOCS in the slash-command UI before `/sp.tasks` runs, so a missing plan is caught at the prompt layer instead of mid-generation.
