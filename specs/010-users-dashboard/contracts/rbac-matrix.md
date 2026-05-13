# RBAC Matrix: Users Dashboard

**Feature**: 010-users-dashboard
**Date**: 2026-05-12

This matrix is the single source of truth for who sees what in the users dashboard. Every cell maps to a specific functional requirement and is enforced by `lib/rbac.ts` + the `<IfRole>` and `<RequireUsersAccess>` boundaries.

---

## Legend

- ✅ **Renders** — affordance is present in the DOM and operable.
- 🚫 **Absent** — affordance is NOT in the DOM (per FR-024). Not disabled — gone.
- 🔁 **Redirect/Deny** — page mounts a "Access Denied" state and never fetches/renders the requested data.
- 👤 **Self only** — allowed only when the target id equals the session's own id.

---

## Navigation

| Surface | admin | manager | developer | FR |
|---------|:-----:|:-------:|:---------:|----|
| "Users" link in app header / sidebar | ✅ | ✅ | 🚫 | FR-023 |

---

## `/users` (Users list page)

| Affordance | admin | manager | developer | FR |
|------------|:-----:|:-------:|:---------:|----|
| Page mounts and fetches list | ✅ | ✅ | 🔁 | FR-001, FR-010 |
| Table rows visible | ✅ | ✅ | 🚫 | FR-001 |
| Search / role filter / status filter | ✅ | ✅ | 🚫 | FR-003, FR-004 |
| Per-row "Edit" action | ✅ | 🚫 | 🚫 | FR-013, FR-024 |
| Click row → navigate to profile | ✅ | ✅ | 🚫 | FR-008 |

---

## `/users/<id>` (User profile page)

| Affordance | admin | manager | developer viewing self | developer viewing other | FR |
|------------|:-----:|:-------:|:----------------------:|:-----------------------:|----|
| Page mounts | ✅ | ✅ | ✅ 👤 | 🔁 | FR-009, FR-010 |
| Read-only profile fields (name, email, role badge, status, timestamps, developer metadata) | ✅ | ✅ | ✅ 👤 | 🚫 | FR-009 |
| "Edit user" button | ✅ | 🚫 | 🚫 | 🚫 | FR-013, FR-024 |
| "User not found" state (when id does not exist) | ✅ | ✅ | n/a | n/a | FR-011 |

---

## Edit user modal (mounted from list or profile)

| Affordance | admin | manager | developer | FR |
|------------|:-----:|:-------:|:---------:|----|
| Modal can be opened at all | ✅ | 🚫 | 🚫 | FR-013, FR-024 |
| Edit name | ✅ | 🚫 | 🚫 | FR-014 |
| Edit role | ✅ | 🚫 | 🚫 | FR-014 |
| Toggle isActive | ✅ | 🚫 | 🚫 | FR-014 |
| Edit email | 🚫 | 🚫 | 🚫 | FR-014 (out of scope on this surface) |
| Edit password | 🚫 | 🚫 | 🚫 | FR-014 (out of scope on this surface) |
| Self-deactivation attempt | ✅ but backend rejects with 409 → inline error | 🚫 | 🚫 | FR-019 |

---

## Session edge cases

| Scenario | Behaviour | FR |
|----------|-----------|----|
| Session expires while on `/users` | Next interaction → redirect to `/login`, preserve `from` URL, show "session ended" notice | FR-025 |
| Role changes in another tab (e.g. admin → developer) | Cross-tab storage sync (from `009-auth-ui`) updates session store; nav and affordances re-render without reload — developer can no longer reach `/users` | FR-026 |
| Deep link to `/users` as developer | `<RequireUsersAccess>` denies → Access Denied page, no fetch made | FR-010 |
| Deep link to `/users/<other-id>` as developer | Same boundary denies → Access Denied | FR-010 |
| Deep link to `/users/<own-id>` as developer | Boundary allows → read-only profile renders | FR-010 |

---

## Mapping to predicates in `lib/rbac.ts`

```ts
canViewUsers(role: Role): boolean         // admin | manager only — gates nav link + /users
canEditUsers(role: Role): boolean         // admin only — gates Edit affordances
canViewUserProfile(                       // /users/<id> gate
  sessionRole: Role,
  sessionUserId: string,
  targetUserId: string,
): boolean                                // admin | manager OR developer-viewing-self
```

These three pure functions are tested in `tests/unit/rbac.test.ts` against the full 3 × 4 truth table (roles × surfaces), and consumed by `<IfRole>`, `<IfAdmin>`, and `<RequireUsersAccess>`.
