---
id: 022
title: Developer Dashboard Spec
stage: spec
date: 2026-06-22
surface: agent
model: claude-sonnet-4-6[1m]
feature: 017-developer-dashboard
branch: 017-developer-dashboard
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: ["developer-dashboard", "frontend", "spec", "rbac"]
links:
  spec: specs/017-developer-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/017-developer-dashboard/spec.md
 - specs/017-developer-dashboard/checklists/requirements.md
tests:
 - none (specification phase)
---

## Prompt

MODULE: Developer Dashboard

PURPOSE:
Provide developers with a dedicated workspace to manage assigned modules, update progress, view earnings, deadlines, and project activity.

---

FEATURES:

1. Dashboard Overview
- Assigned Projects
- Assigned Modules
- Pending Tasks
- Upcoming Deadlines
- Earnings Summary

2. My Modules
- List assigned modules
- Progress percentage
- Status badges
- Deadline tracking

3. Module Progress Updates
- Update progress (0-100)
- Change status
- Add work notes/comments
- View update history

4. My Projects
- View assigned projects
- Project progress
- Client name
- Timeline

5. Earnings
- Project earnings
- Module share %
- Paid amount
- Pending amount

6. Notifications
- New assignments
- Deadline reminders
- Payment updates

---

RBAC:

Developer can:
- View assigned projects
- View assigned modules
- Update assigned module progress
- View own earnings

Developer cannot:
- Create projects
- Delete projects
- Assign modules
- Modify other developers' work

---

PROJECT PROGRESS:

Project progress is derived from module progress.

Developers update modules only.

---

SUCCESS:

Developer can manage daily work from one dashboard.

## Response snapshot

Created branch `017-developer-dashboard` (next number after existing 016) and authored `specs/017-developer-dashboard/spec.md` plus the requirements quality checklist.

Key scoping decisions (informed defaults, no NEEDS CLARIFICATION needed because the codebase made the correct read unambiguous):
- Framed as a **frontend-on-existing-backend** feature mirroring dashboards 010–015. No new backend endpoints/schema/migrations. Data sources: `GET /reports/developers/me` (007), `PATCH /modules/{id}/progress` (005), `GET /payments/developer/me` (006), developer-filtered `GET /projects` (005), `GET /notifications` (008).
- **Scoped OUT** two raw-request items with documented rationale: (1) work notes/comments + update history — no backend support exists; (2) independent "Change status" — backend derives module status from progress (0=pending, 1-99=in_progress, 100=completed), so status is a read-only badge and "changing status" = changing progress.

Five prioritized user stories: US1 overview (P1/MVP), US2 my-modules + progress update (P1), US3 my-projects read-only (P2), US4 earnings (P2), US5 notifications integration (P3). 13 FRs, 7 measurable SCs, edge cases, assumptions, and out-of-scope sections included.

Requirements checklist: all items pass.

## Outcome

- ✅ Impact: Feature spec + quality checklist created for the developer workspace; ready for `/sp.clarify` or `/sp.plan`.
- 🧪 Tests: none (spec phase).
- 📁 Files: specs/017-developer-dashboard/spec.md, specs/017-developer-dashboard/checklists/requirements.md
- 🔁 Next prompts: `/sp.plan` (frontend architecture for the developer dashboard) or `/sp.clarify` if scope of deferred notes/history needs revisiting.
- 🧠 Reflection: Reading sibling specs (006/007/012/014) and the actual backend schema (no notes/history, derived status) prevented inventing unsupported contracts and let two ambiguous request items be scoped out with evidence instead of clarification questions.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell 5.1 `Join-Path` 3-arg limitation broke the create-new-feature.ps1 prompts-dir step; branch + spec file were created successfully, prompts dir created manually.
- Graders run and results (PASS/FAIL): Spec quality checklist PASS (all items).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): patch create-new-feature.ps1 to use nested `Join-Path (Join-Path ...)` for PS 5.1 compatibility.
