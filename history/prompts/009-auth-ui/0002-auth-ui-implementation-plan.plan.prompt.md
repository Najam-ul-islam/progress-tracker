---
id: 0002
title: Auth UI implementation plan
stage: plan
date: 2026-05-11
surface: agent
model: claude-sonnet-4-6
feature: 009-auth-ui
branch: 009-auth-ui
user: Muhammad Najam Ul Islam
command: /sp.plan
labels: ["frontend", "auth", "ui", "plan", "react", "tailwind", "jwt"]
links:
  spec: specs/009-auth-ui/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/009-auth-ui/plan.md
  - specs/009-auth-ui/research.md
  - specs/009-auth-ui/data-model.md
  - specs/009-auth-ui/contracts/backend-refs.md
  - specs/009-auth-ui/contracts/auth-client.md
  - specs/009-auth-ui/quickstart.md
  - CLAUDE.md
tests:
  - none (plan stage; suites scaffolded in tasks)
---

## Prompt

1. Setup auth pages
2. Setup auth API integration
3. JWT storage
4. Protected routing
5. Role-based navigation
6. Validation/testing

## Response snapshot

Generated the implementation plan for `009-auth-ui`. Plan locks the stack to the constitution (React 19 + TS 6 + Tailwind 4 + shadcn/ui file-copy primitives + react-router-dom v7 + Axios + React Query + RHF + Zod + Zustand) and lays out `frontend/src/modules/auth/` per the mandated module structure (`pages/ components/ hooks/ services/ schemas/ store/`). The six user-input items map to milestones: pages (US1, US2, US5), API integration (`auth.api.ts` + interceptors), JWT storage (Zustand `persist` + cross-tab `storage` event), protected routing (`<RequireAuth>` / `<RequireRole>` with return-to-URL behaviour and a hydration gate against flicker), role-based navigation (selectors on the store), and validation/testing (Zod schemas aligned with backend OpenAPI, plus Vitest + MSW + Playwright). Constitution gate: PASS, with one auditable deferral — the 404 page is pushed to `010-app-shell` because this slice has a closed set of routes; recorded in Complexity Tracking. Phase 0 research resolved 10 technical choices (router, HTTP client + 401 handling, persistence, RHF/Zod, server/client state split, guard composition, shadcn consumption, test stack, env var, a11y baseline). Phase 1 produced `data-model.md` (client TS shapes pinned to backend OpenAPI), two contract docs (`auth-client.md` for the internal TS surface, `backend-refs.md` pinning backend OpenAPI references with drift detection), and a `quickstart.md` mapped to spec success criteria. Agent context file updated by `update-agent-context.ps1`.

## Outcome

- ✅ Impact: Slice is ready for `/sp.tasks`. Backend remains untouched; the frontend gains an auth module, app-global HTTP + Query plumbing, and four routes (`/login`, `/register`, `/unauthorized`, `/`). Token storage and 401 handling are centralised in one Axios instance and one Zustand store.
- 🧪 Tests: deferred to tasks. The plan declares Vitest + Testing Library + MSW for unit/component and Playwright for e2e, with one suite per P1 user story plus the role-routing P2 happy path.
- 📁 Files: plan, research, data-model, two contract docs, quickstart, and the regenerated `CLAUDE.md` agent context entry. No source code yet — that's the implementation phase.
- 🔁 Next prompts: `/sp.tasks` to break the plan into dependency-ordered tasks; consider `/sp.adr` for two candidate decisions (see Evaluation notes).
- 🧠 Reflection: the spec's "Components: Auth form, Password input, Loading button, Auth layout" list was kept as the component decomposition in the plan, because they fall out naturally from the form requirements (FR-014, FR-015) and the centred-card aesthetic; resisting the temptation to add more components keeps the slice small. The hardest constraint was the constitution's "shadcn/ui" mandate — resolved by adopting shadcn's upstream file-copy distribution model rather than treating it as a missing npm dep.

## Evaluation notes (flywheel)

- Failure modes observed: none in the planning artifacts themselves. The earlier `/sp.specify` PowerShell hiccup (positional-parameter rejection on a multi-line argument) did not recur here; the dedicated `setup-plan.ps1` accepts `-Json` cleanly.
- Graders run and results (PASS/FAIL): self-graded against the Constitution Check matrix — all 14 rows PASS, one deferral logged in Complexity Tracking (404 page → `010-app-shell`).
- Prompt variant (if applicable): n/a.
- Next experiment (smallest change to try): in `/sp.tasks`, see whether ordering tasks strictly by user-story (US1 → US5) is clearer than ordering by layer (store → http → service → hook → page); the spec's priorities (4× P1, 1× P2) make user-story ordering attractive, and it lets the slice ship an MVP after the first three user stories pass.

## Architectural decisions worth recording (ADR candidates)

These meet the three-part test (long-term impact, alternatives considered, cross-cutting):

1. **Bearer JWT in localStorage with 401 → sign-out, no refresh tokens** — covers persistence, XSS posture, and the absence of silent refresh. Impacts every authenticated module that ships after this one.
2. **Single Axios instance + interceptor pair as the *only* HTTP entry point** — pins the "no API calls in UI components" rule mechanically and makes 401 handling a one-place concern across the app.

📋 Architectural decision detected: bearer-JWT-in-localStorage with 401→sign-out and no refresh tokens — Document reasoning and tradeoffs? Run `/sp.adr auth-token-storage-and-rotation-policy`
📋 Architectural decision detected: single shared Axios instance as the sole HTTP entry point — Document reasoning and tradeoffs? Run `/sp.adr http-client-and-interceptors`
