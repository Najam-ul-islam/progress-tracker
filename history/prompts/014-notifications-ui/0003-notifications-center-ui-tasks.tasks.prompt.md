---
id: 0003
title: Notifications Center UI Tasks
stage: tasks
date: 2026-06-19
surface: agent
model: claude-sonnet-4-6
feature: 014-notifications-ui
branch: 014-notifications-ui
user: Muhammad Najam Ul Islam
command: /sp.tasks
labels: ["notifications", "frontend", "tasks", "react-query"]
links:
  spec: specs/014-notifications-ui/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/014-notifications-ui/tasks.md
tests:
  - none (task-generation phase)
---

## Prompt

1. Create notifications components
2. Add dropdown panel
3. Add notifications list
4. Integrate APIs

## Response snapshot

Generated `tasks.md` — 36 dependency-ordered tasks across 7 phases, organized by the four user stories from spec.md. Tests included (spec Success Criteria + plan's 6 test files require them).

- **Phase 1 Setup** (T001–T003): add `@radix-ui/react-popover`, scaffold module folders, create `components/ui/popover.tsx`.
- **Phase 2 Foundational** (T004–T009): `types.ts`, `notifications.keys.ts` (single shared namespace), `notifications.api.ts` (`fromWire` + typed errors, 404-as-already-gone), `notifications.realtime.ts` (`onNotificationEvent` seam), `formatRelativeTime`, MSW handlers wired into `server.ts`. BLOCKS all stories.
- **Phase 3 US1** (T010–T019): bell + badge + Radix dropdown; `useNotificationFeed`, `UnreadBadge`, `NotificationTypeIcon`, `NotificationItem`, empty/error states, mount in `AppHeader`. MVP.
- **Phase 4 US2** (T020–T023): `/notifications` page + `useNotificationsPage` paging, route under `RequireAuth`.
- **Phase 5 US3** (T024–T029): `useMarkRead` (optimistic+rollback), `useMarkAllRead` (client-composed fan-out), wired into item/bell/dropdown/page.
- **Phase 6 US4** (T030–T032): prove single-invalidation updates all surfaces; non-disruptive background refetch + hidden-tab poll suppression.
- **Phase 7 Polish** (T033–T036): lint/build, a11y/responsive, full test sweep, quickstart manual verification.

Maps the user's four inputs: components → US1 building blocks; dropdown panel → US1; notifications list → US2; API integration → Phase 2 service + US3 mutations. Parallel opportunities and MVP/incremental strategy documented.

## Outcome

- ✅ Impact: Immediately executable task list; MVP = Setup + Foundational + US1.
- 🧪 Tests: 6 component test files + 1 MSW handler module specified, written-first per story.
- 📁 Files: specs/014-notifications-ui/tasks.md.
- 🔁 Next prompts: `/sp.implement` (or `/sp.adr` first for the two flagged decisions).
- 🧠 Reflection: Sequenced US3 after US1+US2 because mark-read wires actions INTO those surfaces; kept each story independently testable via its own MSW-backed test files.

## Evaluation notes (flywheel)

- Failure modes observed: none — check-prerequisites returned all four design docs; template followed.
- Graders run and results (PASS/FAIL): Checklist-format self-check — PASS (all 36 tasks have checkbox + ID + file path; story labels on US-phase tasks only).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): during implement, confirm the dropdown open-state survives background refetch (T032) early, since it's the subtlest SC-009 risk.
