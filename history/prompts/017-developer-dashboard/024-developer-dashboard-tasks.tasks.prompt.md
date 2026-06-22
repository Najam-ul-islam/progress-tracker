---
id: 024
title: Developer Dashboard Tasks
stage: tasks
date: 2026-06-22
surface: agent
model: claude-sonnet-4-6
feature: 017-developer-dashboard
branch: 017-developer-dashboard
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["developer-dashboard", "frontend", "tasks", "implementation"]
links:
  spec: specs/017-developer-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/017-developer-dashboard/tasks.md
tests:
  - none (tasks phase)
---

## Prompt

MODULE: Developer Dashboard

TASKS:

1. Create /developer/dashboard

2. Build Overview Cards
- Active Projects
- Active Modules
- Upcoming Deadlines
- Total Earnings

3. Build My Projects Section
- Project table
- Progress bars
- Status badges

4. Build My Modules Section
- Module table
- Progress
- Deadline
- Assigned share %

5. Build Progress Update Dialog
- Progress %
- Status
- Notes
- Save action

6. Build Earnings Section
- Total earned
- Pending earnings
- Project-wise earnings

7. Build Notifications Widget

8. Responsive + Accessibility QA

SUCCESS:
Developer can manage assigned work independently.

## Response snapshot

Generated `specs/017-developer-dashboard/tasks.md` with 31 tasks organized into 8 phases mapping to the 5 user stories from spec.md (US1-US5) and the user's 8 development phases. The tasks follow the checklist format from the template, with tests specified per story. Key structure decisions:

- Phase 1: Routes & Developer Guard (foundational)
- Phase 2: Overview Cards (US1 - P1 MVP)
- Phase 3: My Projects Section (US3 - P2)
- Phase 4: My Modules Section (US2 - P1)
- Phase 5: Progress Update Dialog (US2 - P1)
- Phase 6: Earnings Section (US4 - P2)
- Phase 7: Notifications Widget (US5 - P3)
- Phase 8: Responsive + Accessibility QA

Dependencies documented: US1 can start immediately after Phase 1; US3/US6/US7 can run parallel; US5 needs US2 surfaces. MVP strategy focuses on completing Phase 1-2 for basic overview, then Phases 4-5 for module management with progress updates.

## Outcome

- ✅ Impact: Task list created for developer workspace implementation; ready for `/sp.implement` or manual task execution.
- 🧪 Tests: none (tasks phase); test tasks defined within each user story phase.
- 📁 Files: specs/017-developer-dashboard/tasks.md
- 🔁 Next prompts: `/sp.implement` to start implementation, or tasks can be executed directly.
- 🧠 Reflection: The task list leverages existing components (UpdateProgressDialog, StatusBadge, ProgressBar, KpiCard, useMySelfReport, notification hooks) to minimize duplicate work, consistent with the constitution Hard Constraint on reuse.

## Evaluation notes (flywheel)

- Failure modes observed: none blocking
- Graders run and results (PASS/FAIL): Tasks format validated against template requirements
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): verify task dependencies are correctly sequenced when implementation begins