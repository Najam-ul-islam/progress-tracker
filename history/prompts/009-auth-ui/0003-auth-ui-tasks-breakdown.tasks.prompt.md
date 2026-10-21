---
id: 0003
title: Auth UI tasks breakdown
stage: tasks
date: 2026-05-11
surface: agent
model: claude-sonnet-4-6
feature: 009-auth-ui
branch: 009-auth-ui
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["frontend", "auth", "ui", "tasks", "tdd", "react", "playwright"]
links:
  spec: specs/009-auth-ui/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/009-auth-ui/tasks.md
tests:
  - planned (Vitest unit + component, MSW for component isolation, Playwright e2e — authored before implementation per task)
---

## Prompt

1. Create auth pages
2. Create login/register forms
3. Integrate Axios APIs
4. Store JWT token
5. Implement protected routes
6. Add loading/error handling
7. Validate auth flow

## Response snapshot

Generated `specs/009-auth-ui/tasks.md` — 78 tasks across 8 phases, organised by user story per the spec's priority ordering. Setup (T001–T009) installs the constitution-mandated deps + test stack. Foundational (T010–T025) builds the app-global plumbing: shadcn primitives (file-copy), the Zustand session store with `persist` + cross-tab `storage` sync, the single Axios instance with bearer + 401 interceptors, the QueryClient singleton, the router shell with hydration gate, and MSW handlers. Each user story phase opens with its own failing-tests batch and closes with a checkpoint matching the spec's "Independent Test" criterion. The seven user-input items map across phases: auth pages (T038, T039, T047, T065 — US1/US2/US5), login/register forms (T031, T035, T036, T037, T044 — US1/US2), Axios integration (T019, T032, T045, T057 — Foundational + US1/US2/US4), JWT storage (T017, T018 — Foundational), protected routes (T059, T060, T064, T067 — US4/US5), loading/error handling (T037, T038 alerts, T061 session-ended banner, T070 — cross-cutting), validate auth flow (every `Tests for User Story N` block + the Polish phase). MVP is US1+US2+US3 (T001–T053); US4 hardens routing; US5 layers role-based nav. Tests included — constitution mandates frontend loading/error-state and RBAC validation, and the user prompt's "Validate auth flow" item is the testing deliverable. Format validated: every task is a markdown checkbox with `T###` ID, `[P]` marker where parallelisable, `[USx]` label inside user-story phases (omitted in Setup/Foundational/Polish per template), and a specific file path.

## Outcome

- ✅ Impact: Slice is ready for `/sp.implement`. Backend stays untouched; the frontend gains a self-contained auth module, app-global HTTP + Query plumbing, and tests covering every spec success criterion (SC-001 through SC-008). MVP can be cut at T053.
- 🧪 Tests: planned in every story phase (5 unit tests, 7 component tests, 5 e2e specs). Tests are authored before their implementation tasks and must fail first.
- 📁 Files: `specs/009-auth-ui/tasks.md`. No source code yet.
- 🔁 Next prompts: `/sp.implement` to execute the tasks; optionally `/sp.adr` for the two ADR candidates surfaced in the plan PHR (JWT storage policy, single Axios entrypoint) before implementation begins.
- 🧠 Reflection: the spec's 4× P1 stories tempted a single mega-phase; splitting them keeps each P1 individually shippable (US1 alone is a usable product; US3 layered on top closes the credential loop) and matches the spec's "independently testable" rule. The fixture admin-only route in T067 + cleanup TODO in T077 is the only debt this slice introduces, and it exists solely so US5 can be tested before any real admin-only route ships.

## Evaluation notes (flywheel)

- Failure modes observed: none in artifact generation. Earlier `/sp.specify` PowerShell quirk did not recur — `check-prerequisites.ps1 -Json` cleanly returned `FEATURE_DIR` and `AVAILABLE_DOCS`.
- Graders run and results (PASS/FAIL): self-graded format — every task has `- [ ]`, `T###`, file path, and a story label where required. Constitution gate re-affirmed (the 404-page deferral noted in the plan stays the only declared deviation).
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): during `/sp.implement`, see whether batching all `[P]` tests for a story into a single commit (vs one commit per test) accelerates the red→green loop without obscuring the diff history.
