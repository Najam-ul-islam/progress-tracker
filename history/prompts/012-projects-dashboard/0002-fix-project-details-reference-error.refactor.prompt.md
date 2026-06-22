---
id: 0002
title: Fix Project Details ReferenceError
stage: refactor
date: 2026-06-19
surface: agent
model: gemini-3.5-flash
feature: 012-projects-dashboard
branch: 014-notifications-ui
user: Muhammad Najam Ul Islam
command: debug-error
labels: ["projects", "frontend", "debugging", "react-query"]
links:
  spec: specs/012-projects-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - frontend/src/modules/projects/pages/ProjectDetailsPage.tsx
tests:
  - npm run test
---

## Prompt

```
Unexpected Application Error!
progress is not defined
ReferenceError: progress is not defined
    at ProjectDetailsPage (http://localhost:5173/src/modules/projects/pages/ProjectDetailsPage.tsx:51:30)
    at Object.react_stack_bottom_frame (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:12868:12)
    at renderWithHooks (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:4213:19)
    at updateFunctionComponent (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:5569:16)
    at beginWork (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:6140:20)
    at runWithFiberInDEV (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:851:66)
    at performUnitOfWork (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:8429:92)
    at workLoopSync (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:8325:37)
    at renderRootSync (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=21a42641:8309:6)
    at performWorkOnRoot (http://localhost:5173/node_modules/.gemini/antigravity-cli/node_modules/.vite/deps/react-dom_client.js?v=21a42641:7994:27)
💿 Hey developer 👋

You can provide a way better UX than this when your app throws errors by providing your own ErrorBoundary or errorElement prop on your route.
```

## Response snapshot

Identified that `ProjectDetailsPage.tsx` was missing the `useQuery` hooks to fetch `project` detail and `progress` details, leading to reference errors (e.g., `progress is not defined` and subsequently `project`, `isLoadingProject`, `projectError`, `isLoadingProgress` not being defined).

Added the missing `useQuery` definitions:
```typescript
  const { data: project, isLoading: isLoadingProject, error: projectError } = useQuery({
    queryKey: PROJECTS_QUERY_KEYS.detail(projectId),
    queryFn: () => projectsApi.get(projectId),
    enabled: !isNaN(projectId),
  });

  const { data: progress, isLoading: isLoadingProgress } = useQuery({
    queryKey: PROJECTS_QUERY_KEYS.progress(projectId),
    queryFn: () => projectsApi.getProgress(projectId),
    enabled: !isNaN(projectId),
  });
```

Ran typecheck (`npx tsc --noEmit`) and component tests (`npm run test`) to verify correctness, with all 253 tests passing.

## Outcome

- ✅ Impact: Fixed ReferenceError causing the Project Details Page to crash.
- 🧪 Tests: Checked typescript compiler (clean build) and ran vitest suite (253 tests passed).
- 📁 Files: frontend/src/modules/projects/pages/ProjectDetailsPage.tsx
- 🔁 Next prompts: None
- 🧠 Reflection: The Project Details Page was implemented as a work-in-progress where the variables for project and progress were referenced throughout the JSX rendering, but the actual react-query hooks that fetch and populate them were completely missing. Adding them resolved the issue cleanly.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
