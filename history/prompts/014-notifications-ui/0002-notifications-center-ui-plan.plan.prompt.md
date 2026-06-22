---
id: 0002
title: Notifications Center UI Plan
stage: plan
date: 2026-06-19
surface: agent
model: claude-sonnet-4-6
feature: 014-notifications-ui
branch: 014-notifications-ui
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["notifications", "frontend", "plan", "react-query", "real-time"]
links:
  spec: specs/014-notifications-ui/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/014-notifications-ui/plan.md
  - specs/014-notifications-ui/research.md
  - specs/014-notifications-ui/data-model.md
  - specs/014-notifications-ui/contracts/notifications.frontend.md
  - specs/014-notifications-ui/quickstart.md
  - CLAUDE.md
tests:
  - none (planning phase)
---

## Prompt

1. Notification dropdown
2. Notifications page
3. Read/unread UI
4. API integration

## Response snapshot

Generated the implementation plan and Phase 0/1 design artifacts for the notifications center frontend, grounded in the existing codebase (`009-auth-ui` foundation: `@/lib/http`, `query-client.ts`, `session.store`, `AppHeader`, `routes.tsx`; `users` module conventions) and the frozen `008-notifications` backend contract.

Key design decisions:
- **New module** `frontend/src/modules/notifications/` following the constitution's strict frontend layout (pages/components/hooks/services); additive edits only to `AppHeader` (mount `<NotificationBell/>`) and `routes.tsx` (`/notifications` under `RequireAuth`).
- **Single shared query namespace** (`notifications.keys.ts`): badge + dropdown both read `feed()` (one deduplicated fetch); page uses `page(limit,offset)`; `all` prefix is the blanket invalidation key (FR-017).
- **Real-time-ready seam** (`notifications.realtime.ts` → `onNotificationEvent(queryClient)`): the single documented entry point a future WebSocket/SSE handler calls; structurally proven by a contract test (FR-020, SC-007).
- **Polling + focus refetch**, `refetchIntervalInBackground:false` so polling pauses when the tab is hidden (FR-018/FR-019); no bespoke visibility listener.
- **Optimistic mark-read with rollback** via the canonical `onMutate`/`onError`/`onSettled` recipe (FR-014/FR-015); **mark-all** composed client-side per-id since the backend has no batch endpoint (FR-013, flagged as follow-up).
- **New dependency** `@radix-ui/react-popover` for the accessible dropdown (consistent with the existing `@radix-ui/react-dialog`); new `components/ui/popover.tsx` wrapper.

Constitution Check PASS both pre-research and post-design. Ran `update-agent-context.ps1` (updated CLAUDE.md). Artifacts: plan.md, research.md (R1–R8), data-model.md, contracts/notifications.frontend.md, quickstart.md.

## Outcome

- ✅ Impact: Planning-ready design; frontend-only, no backend changes; tasks-ready.
- 🧪 Tests: N/A (plan phase); 6 component test files specified in the structure + 1 MSW handler module.
- 📁 Files: plan.md, research.md, data-model.md, contracts/notifications.frontend.md, quickstart.md, CLAUDE.md (agent context).
- 🔁 Next prompts: optionally `/sp.adr` for the two significant decisions, then `/sp.tasks`.
- 🧠 Reflection: The single-shared-query design is the lynchpin — it satisfies both the cross-surface consistency requirement and the real-time-ready requirement with one mechanism.

## Evaluation notes (flywheel)

- Failure modes observed: `update-agent-context.ps1` requires an absolute path under this shell (relative/`&` invocations failed with CommandNotFound); succeeded with the full path.
- Graders run and results (PASS/FAIL): Constitution Check — PASS (pre + post design).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): consider validating the mark-all chattiness assumption against a realistic unread-count distribution before committing to client-side composition.
