---
id: 023
title: Developer Dashboard Plan
stage: plan
date: 2026-06-22
surface: agent
model: claude-sonnet-4-6[1m]
feature: 017-developer-dashboard
branch: 017-developer-dashboard
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["developer-dashboard", "frontend", "plan", "reuse", "rbac"]
links:
  spec: specs/017-developer-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/017-developer-dashboard/plan.md
 - specs/017-developer-dashboard/research.md
 - specs/017-developer-dashboard/data-model.md
 - specs/017-developer-dashboard/contracts/consumed-endpoints.md
 - specs/017-developer-dashboard/quickstart.md
 - CLAUDE.md
tests:
 - none (planning phase)
---

## Prompt

MODULE: Developer Dashboard

PHASES:

1. Dashboard Layout
2. Overview Widgets
3. My Projects
4. My Modules
5. Progress Update UI
6. Earnings Dashboard
7. Notifications
8. Responsive QA

COMPONENTS:

- DashboardStats
- AssignedProjectsTable
- AssignedModulesTable
- ProgressUpdateDialog
- EarningsCards
- NotificationsPanel

## Response snapshot

Ran setup-plan.ps1 and authored the full Phase 0/1 planning artifact set for the frontend developer dashboard.

Key architectural findings (drove the plan toward reuse over rebuild):
- Much already exists: `earnings` module wraps `GET /reports/developers/me` (`useMySelfReport`) and `GET /payments/developer/me`; `projectsApi.updateModuleProgress` + `UpdateProgressDialog` implement `PATCH /modules/{id}/progress`; `notifications` module has feed components; `DashboardPage` already branches to `DeveloperDashboardContent`; `navigation.config.ts` role-gates the sidebar.
- **Net-new work** = a dedicated `frontend/src/modules/developer` module that composes these into a deliberate workspace + the deadline-join logic + developer routing/guard. Avoids duplicate business logic (constitution Hard Constraint).
- **Deadline source decision (R1)**: neither `DeveloperSelfModule` nor the backend `ProjectModule` has a deadline field — only `Project` has `end_date`. So deadlines are derived client-side by joining self-report modules → parent project `end_date` via developer-filtered `GET /projects`. No backend change (FR-012).
- Status is read-only/derived from progress (R3); only progress (0–100) is writable.
- Invalidation set defined for FR-006: on progress write, invalidate self-report + projects list/progress/detail keys so overview/modules/projects/earnings stay consistent.

Mapped the user's 8 phases and 6 requested components 1:1 onto the spec's prioritized stories (US1–US5). Constitution Check: PASS pre- and post-design (additive, reuse, RBAC-consistent, API-first, no invented contracts) — no Complexity Tracking needed.

Artifacts: plan.md, research.md, data-model.md, contracts/consumed-endpoints.md, quickstart.md. Ran update-agent-context.ps1 (updated CLAUDE.md).

## Outcome

- ✅ Impact: Complete implementation plan + design artifacts ready for `/sp.tasks`.
- 🧪 Tests: none (plan phase); quickstart defines the verification matrix.
- 📁 Files: 5 spec artifacts + CLAUDE.md context update.
- 🔁 Next prompts: `/sp.tasks` to generate the dependency-ordered task list; optionally `/sp.adr` if the "reuse existing earnings/projects modules vs. standalone developer module" decision warrants recording.
- 🧠 Reflection: Reading the actual frontend modules (earnings, projects, dashboard, notifications, navigation.config) before planning revealed ~80% of plumbing already exists, turning this from a build into a compose-and-extend effort — and surfaced the deadline-field gap that the join decision resolves without backend work.

## Evaluation notes (flywheel)

- Failure modes observed: none blocking. (Prior spec-phase PowerShell 5.1 Join-Path issue not triggered here.)
- Graders run and results (PASS/FAIL): Constitution Check PASS (pre + post design).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): in /sp.tasks, confirm whether to re-home the existing `/earnings` page under the developer module or leave it in place and link to it (avoid moving tested code unnecessarily).
