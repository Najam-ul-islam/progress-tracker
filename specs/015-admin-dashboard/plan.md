# Implementation Plan: Modern SaaS Admin Dashboard

**Branch**: `015-admin-dashboard` | **Date**: 2026-06-19 | **Spec**: [specs/015-admin-dashboard/spec.md](file:///D:/progress-tracker/specs/015-admin-dashboard/spec.md)
**Input**: Feature planning guidelines (Foundations, App Shell, Widgets, Theme System, Responsive, Polish)

## 1. Foundations

### Tailwind Theme Tokens
Tailwind v4 is used in the frontend. We will configure theme tokens directly in `frontend/src/index.css` using the `@theme` directive, establishing custom brand palettes rather than standard shadcn/ui defaults:
- **Brand colors**: High-contrast indigo/violet hybrid colors supporting accessible contrast ratios in both light and dark modes.
- **Spacing**: Base-4 modular scale (`0.5` = 2px, `1` = 4px, `2` = 8px, `3` = 12px, `4` = 16px, `6` = 24px, `8` = 32px).
- **Border radius**: Curved aesthetic (`--radius-lg`: 12px, `--radius-md`: 8px, `--radius-sm`: 4px) for premium look.

### Dark Mode Strategy
- **HTML Class Strategy**: Dark mode is activated by appending the `.dark` class to `document.documentElement` (`<html class="dark">`).
- **Persistence**: Preference (`theme: 'light' | 'dark' | 'system'`) is stored in `localStorage` under the key `theme`.
- **FOUC Prevention**: An inline, blocking `<script>` is placed in the `<head>` of `index.html` to parse and apply the theme preference before layout paint, eliminating any flashes of the wrong color.

### Shared TypeScript Types
Define robust types for mock services and presentational widgets:
```typescript
export type Theme = "light" | "dark" | "system";

export interface KPIData {
  label: string;
  value: string | number;
  delta: string;
  trend: "up" | "down" | "neutral";
  description?: string;
}

export interface NavSubItem {
  label: string;
  path: string;
}

export interface NavItem {
  label: string;
  path?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavSubItem[];
}

export interface ActivityEvent {
  id: string;
  user: {
    name: string;
    avatarUrl?: string;
    initials: string;
  };
  action: string;
  timestamp: string; // ISO Date string
  category: "security" | "billing" | "system" | "user";
}
```

---

## 2. App Shell & Layout

- **AppLayout Container**: A grid with the sidebar locked on the left (collapsing from `240px` to `64px` via transition) and the main content scroll pane on the right.
- **Config-Driven Sidebar**: Replaced hardcoded nav blocks with an array-driven data configuration matching `NavItem[]`. Submenu toggling uses local component expand/collapse state.
- **Slot-Based Navbar**: Exposes structured layout slots:
  - `leftSlot`: breadcrumb/page title context.
  - `rightSlot`: action triggers (search, notifications, theme toggle, user profile).
- **Mobile Off-Canvas Drawer**: On mobile viewports (<1024px), the sidebar is hidden and triggered from the navbar hamburger button, sliding in from the left as an overlay drawer with a blurring backdrop.

---

## 3. Reusable Widgets (Standalone First)

Widgets are decoupled from application-specific data. They accept standard React props and render skeletons or empty screens:
1. **KpiCard**: Exposes states for `isLoading` (renders animated pulsing skeletons) and `isEmpty` (dashed border card with info warning). Renders delta metrics with trend indicators.
2. **DataTable**: Generic client-side paginated data table accepting `data` and `columns`. Column definitions support custom cells via render hooks.
3. **ChartWidget**: Wraps Recharts `ComposedChart` to plot revenue, active users, and cost metrics, resizing fluidly inside parent grids.
4. **ActivityFeed**: Timed list mapping event categories to corresponding Lucide icons and colors.
5. **DashboardPage Assembly**: Composes these widgets under a grid matching target responsive widths (1 col mobile → 2 col tablet → 4 col desktop).

---

## 4. Theme System & Contrast

- **CSS Theme Mapping**: Map color tokens to Tailwind utility classes. Use semantic background variables (`bg-white` / `dark:bg-slate-900`) and borders (`border-slate-200` / `dark:border-slate-800`).
- **Contrast Check**: Ensures light-mode text meets WCAG AA standards (minimum 4.5:1 ratio on text overlays) and dark-mode background colors utilize true dark slate hues instead of simple high-contrast solid blacks.

---

## 5. Responsive Pass

- **Breakpoints**: Mobile (<640px), Tablet (640px–1024px), Desktop (>1024px).
- **Reflow Grids**: KPI Card grid adjusts columns (1 → 2 → 4) dynamically.
- **Table Scroll**: Data Table is wrapped in a horizontal scroll viewport (`overflow-x-auto`) to prevent layout breaking on narrow viewports.

---

## 6. Polish Pass

- **A11y & Focus**: Add visible focus rings (`focus-visible:ring-2`) and keyboard focus outlines across navigation items and toggles.
- **Motion Reduction**: Restrict transition durations under media checks for users with `prefers-reduced-motion: reduce`.
- **Demo State Toggles**: Provide interactable dashboard switches on the page header to easily swap widgets between loading skeletons, empty data, and normal states.
