<!--
Sync Impact Report
==================
Version change: 0.0.0 (template) → 1.0.0 (initial ratification)
Bump rationale: MAJOR — first concrete adoption; replaces all placeholders with binding
principles. No prior principles to deprecate; this is the canonical baseline.

Modified principles (placeholder → concrete):
- [PRINCIPLE_1_NAME] → I. Spec-First Development
- [PRINCIPLE_2_NAME] → II. Modular Monolith Architecture
- [PRINCIPLE_3_NAME] → III. Deterministic Development
- [PRINCIPLE_4_NAME] → IV. Incremental Evolution
- [PRINCIPLE_5_NAME] → V. AI-Native Workflow
- [PRINCIPLE_6_NAME] → (removed — collapsed into V; project requires 5 principles, not 6)

Added sections:
- Mandatory Spec Workflow
- Backend Standards (Stack, Module Structure, Architecture Rules, Database Rules,
  Authentication Standards, API Standards, Payment Rules, uv Rules)
- Frontend Standards (Stack, Module Structure, Architecture Rules, Form Standards,
  State Management Rules, Routing & Security Rules, UI/UX Standards)
- Reporting & Notifications
- Git & Branch Workflow
- Testing Standards
- Hard Constraints
- Success Criteria
- Development Lifecycle
- Future Expansion Goals

Removed sections:
- [SECTION_2_NAME] / [SECTION_3_NAME] template slots — superseded by the concrete
  Backend Standards, Frontend Standards, and other named sections above.

Templates requiring updates:
- ✅ .specify/templates/plan-template.md — Constitution Check block is generic
  ("Gates determined based on constitution file"); no edits needed because it
  delegates gate definition to this file.
- ✅ .specify/templates/spec-template.md — no constitution references; no edits needed.
- ✅ .specify/templates/tasks-template.md — no constitution references; no edits needed.
- ✅ CLAUDE.md — already references `.specify/memory/constitution.md` as the source
  of code-quality, testing, performance, security, and architecture principles;
  no edits needed.

Follow-up TODOs: none. All placeholders resolved; no deferred items.
-->

# AI-Native SaaS Platform Constitution

## Core Principles

### I. Spec-First Development
No feature implementation without an approved specification. Claude Code generates ALL implementation from specs. No skipping stages.

### II. Modular Monolith Architecture
Not microservices — one codebase, isolated domains. Every module must be isolated, reusable, and independently testable. Feature-based folder structure (backend + frontend).

### III. Deterministic Development
Every feature must define: inputs, outputs, validations, business rules. All financial calculations must be deterministic and auditable.

### IV. Incremental Evolution
Each module builds safely without regressions. No massive refactors without a spec.

### V. AI-Native Workflow
Claude Code executes all implementation. Workflow: Specs → Plans → Tasks → Implementations.

## Mandatory Spec Workflow

Required (in order):
- `/sp.specify`
- `/sp.plan`
- `/sp.tasks`
- `/sp.implement`

Optional:
- `/sp.adr`

**Rule**: No implementation without an approved specification. No skipping stages.

## Backend Standards

### Stack
- FastAPI
- SQLModel
- PostgreSQL
- Alembic
- Uvicorn
- uv (package manager — no pip, no manual venv)

### Module Structure (strictly enforced)
```
module/
├── model.py          # SQLModel ORM definitions only
├── schema.py         # Pydantic request/response schemas
├── repository.py     # DB access ONLY — no business logic
├── service.py        # ALL business logic lives here
├── routes.py         # Calls service layer ONLY
└── dependencies.py   # Dependency injection
```

### Architecture Rules
- NO business logic in routes
- NO direct DB access from routes
- Repository layer handles DB access only
- Service layer handles all business logic
- Shared utilities go in core/
- Models are ONLY for schema definitions (SQLModel)

### Database Rules
- PostgreSQL is mandatory
- SQLModel for all ORM models
- Alembic for all migrations
- UUIDs preferred for all primary keys (future scalability)
- All relationships must be explicitly defined

### Authentication Standards
- JWT authentication (HS256 signing)
- bcrypt for password hashing
- RBAC enforced across all protected endpoints
- Roles: admin | manager | developer

### API Standards
- RESTful APIs only
- Consistent response schemas across all endpoints
- Input validation required on all endpoints
- Proper HTTP status codes mandatory
- Pagination required on all list endpoints

### Payment Rules (mandatory business logic)
- 30% company reserve
- 70% distributed to developers
- Module share percentages determine individual developer earnings
- Share totals CANNOT exceed 70%
- All payment calculations centralized in the service layer only

### uv Rules
Allowed:   uv add | uv run
Forbidden: pip | manual venv activation

## Frontend Standards

### Stack
- React + TypeScript
- TailwindCSS
- shadcn/ui
- React Query (server state)
- Axios (HTTP client)
- React Hook Form + Zod (forms & validation)
- Zustand (local/global state — optional)

### Module Structure (strictly enforced)
```
module/
├── pages/            # Route-level page components
├── components/       # Module-specific UI components
├── hooks/            # Custom hooks (data fetching, logic)
├── services/         # Axios API calls — NOT inside UI components
├── schemas/          # Zod validation schemas
└── store/            # Zustand slices (if applicable)
```

### Architecture Rules
- NO direct API calls inside UI components — use hooks/services
- NO business logic in UI components
- Reusable components are required
- Shared/common UI components must be centralized (e.g. components/ui/)
- Type safety is mandatory — no implicit `any`
- API-first: frontend depends on backend contract

### Form Standards
- React Hook Form required for all forms
- Zod schema validation required (client-side + aligned with server-side)
- Shared form components preferred over one-off implementations

### State Management Rules
- React Query for all server state (fetching, caching, mutations)
- Zustand for local/global UI state
- Prop drilling must be avoided

### Routing & Security Rules
- Protected routes required for all authenticated pages
- JWT-based auth flow (store token securely, attach to requests)
- Role-aware navigation (hide/show based on RBAC role)
- Unauthorized (403) and Not Found (404) pages required

### UI/UX Standards (mandatory)
- Responsive design across all breakpoints
- Loading states on all async operations
- Error states with user-friendly messages
- Empty states for all list/data views
- Accessible forms (labels, ARIA where needed)
- Modern SaaS dashboard styling

### UI/UX Standards (optional but preferred)
- Dark mode support
- Skeleton loaders instead of spinners where possible

## Reporting & Notifications

Reporting module must provide:
- Dashboard analytics
- Project reports
- Developer performance metrics
- Financial summaries
- KPI-ready aggregated data

Notification system must support:
- In-app notifications
- Assignment alerts
- Payment alerts
- Deadline reminders
- Future-ready: email notifications, WebSocket real-time events

## Git & Branch Workflow

- Every module gets a dedicated branch and spec folder
- Branch naming: `{id}-{module-name}`
  Example: `003-users-management | 004-clients-management`

## Testing Standards

Every module must validate:
- Success cases
- Validation errors
- RBAC restrictions
- API behavior
- Frontend loading states
- Frontend error states

## Hard Constraints (never violate)

- ✗ No massive refactors without a spec
- ✗ No duplicate business logic across modules
- ✗ No tight coupling between modules
- ✗ No direct DB access from routes
- ✗ No business logic in API routes
- ✗ No direct API calls from UI components
- ✗ No implicit `any` in TypeScript
- ✗ No pip or manual venv — uv only

## Success Criteria

The platform is successful when:
- ✓ Backend modules are modular, layered, and stable
- ✓ Frontend is responsive, type-safe, and reusable
- ✓ RBAC enforced consistently across backend and frontend
- ✓ Payments calculated accurately with full auditability
- ✓ Specs fully traceable to implementation
- ✓ Claude Code can safely extend the system without regressions

## Development Lifecycle (mandatory order)

`/sp.constitution` → `/sp.specify` → `/sp.plan` → `/sp.tasks` → `/sp.implement`

## Future Expansion Goals

Architecture must remain ready for:
- AI agents integration
- Real-time collaboration (WebSockets)
- Multi-tenancy
- Kubernetes deployment
- Microservices extraction
- Mobile applications
- Cloud-native infrastructure

**Version**: 1.0.0 | **Ratified**: 2026-05-10 | **Last Amended**: 2026-05-10