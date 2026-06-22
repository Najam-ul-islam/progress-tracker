---
id: 0002
title: Dashboard Architectural Plan
stage: plan
date: 2026-06-19
surface: agent
model: gemini-3.5-flash
feature: 015-admin-dashboard
branch: 015-admin-dashboard
user: Muhammad Najam Ul Islam
command: sp.plan
labels: ["planning", "architecture", "theme", "layout"]
links:
  spec: specs/015-admin-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/015-admin-dashboard/plan.md
tests:
  - none
---

## Prompt

```
/sp.plan 1. Foundations


Set up Tailwind theme tokens (colors, spacing, radius) — see Design Direction below, not shadcn defaults as-is
Set up dark mode strategy: class strategy on <html>, theme stored in localStorage, applied before paint (inline script) to avoid flash
Define TypeScript types for shared data shapes (KPIData, NavItem, TableRow, etc.)


2. App shell / layout


AppLayout: grid with sidebar + main content area
Sidebar: nav config-driven (array of {label, icon, href, children?}), not hardcoded JSX per item
Navbar: slot-based (left: title/breadcrumb, right: actions)
Mobile: sidebar becomes a Sheet/drawer triggered from navbar hamburger


3. Dashboard widgets (build as standalone, story-tested components first)


KpiCard (label, value, delta, trend, loading/empty states)
DataTable (generic, paginated, sortable columns)
ChartWidget (wraps a charting lib, accepts series data)
ActivityFeed (timestamped list)
Compose these into the actual /dashboard page last, once each works in isolation


4. Theme system


CSS variables for color tokens, light/dark variants
ThemeToggle component using the strategy from step 1
Verify contrast in both modes (not just inverted defaults)


5. Responsive pass


Test each breakpoint per component, not just the page as a whole
Sidebar collapse behavior, KPI grid reflow, table horizontal scroll on mobile


6. Polish pass


Keyboard focus states, reduced-motion support
Loading/empty/error states wired into mock data toggles so they're demoable
```

## Response snapshot

Enriched the implementation plan at `specs/015-admin-dashboard/plan.md` to incorporate:
- Detailed foundations regarding Tailwind theme tokens, HTML class dark mode, and TypeScript types.
- Layout details describing grid structure, slot-based Navbar, and config-driven Sidebar.
- Decoupled widgets strategy, theme contrast specifications, and breakpoint reflow patterns.
- Focus states, reduced-motion media checks, and toggleable state simulation.

## Outcome

- ✅ Impact: Shared SpecKit Plus plan updated to detail foundations, shell configs, theme rules, and responsive design guidelines.
- 🧪 Tests: None (Planning phase).
- 📁 Files: specs/015-admin-dashboard/plan.md
- 🧠 Reflection: Documenting the exact layout slots and tailwind tokens ensures standard compliance and developer alignment during future extension.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
