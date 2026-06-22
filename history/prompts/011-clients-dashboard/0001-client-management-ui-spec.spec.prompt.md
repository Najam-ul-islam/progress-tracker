---
id: 0001
title: Client Management UI Spec
stage: spec
date: 2026-06-13
surface: agent
model: claude-opus-4-8[1m]
feature: 011-clients-dashboard
branch: 011-clients-dashboard
user: Muhammad Najam Ul Islam
command: /sp.specify
labels: ["clients", "frontend", "dashboard", "rbac", "crud"]
links:
  spec: specs/011-clients-dashboard/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/011-clients-dashboard/spec.md
 - specs/011-clients-dashboard/checklists/requirements.md
tests:
 - none (specification stage; no code or tests produced)
---

## Prompt

Build client management UI.

Pages:
- Clients list
- Client details
- Create/edit client

Features:
- Client table
- Search/filter
- Contact info cards
- CRUD dialogues

## Response snapshot

Created branch `011-clients-dashboard` (next number after `010-users-dashboard`; short-name mirrors the users-dashboard convention). Identified the feature as the **frontend** for the existing `004-clients-management` backend, parallel to how `010-users-dashboard` fronts `003-users-management`. Read the backend contract (`004-clients-management/contracts/openapi.yaml` + `access-control-matrix.md`) as the source of truth for fields, validation, error codes, and RBAC.

Authored `spec.md` with six prioritized user stories: (US1) list + client-side search across name/company/email/phone, (US2) details page with contact-info cards, (US3) create-via-dialog, (US4) edit-via-dialog sending only changed fields, (US5) admin-only delete behind a confirmation, and (US6) RBAC-aware navigation/affordances. 31 functional requirements (FR-001–FR-031), Client/ClientsFilter/ClientDraft entities, 8 measurable success criteria, plus Assumptions and Out-of-Scope.

Key RBAC facts driving the spec, taken from the backend matrix: admin + manager may view/create/edit; **delete is admin-only**; **developers have zero access** (no self-view carve-out, unlike users dashboard). Email + phone are editable here (unlike the users dashboard's locked email) with 409 duplicate handling surfaced inline.

Reconciled a prompt ambiguity — "Create/edit client" listed under *Pages* vs "CRUD dialogues" under *Features* — in favour of modal dialogs consistent with the `010-users-dashboard` pattern, documented in Assumptions; no `[NEEDS CLARIFICATION]` marker was needed. Wrote `checklists/requirements.md`; all quality items pass.

## Outcome

- ✅ Impact: Feature 011 specified and validated; ready for `/sp.clarify` or `/sp.plan`.
- 🧪 Tests: none (spec stage).
- 📁 Files: spec.md, checklists/requirements.md created on branch 011-clients-dashboard.
- 🔁 Next prompts: `/sp.clarify` (optional) then `/sp.plan` to design the frontend implementation atop the 009/010 foundation.
- 🧠 Reflection: Mirroring the established 010-users-dashboard structure kept the spec consistent; the backend access-control matrix resolved all RBAC questions without needing user clarification.

## Evaluation notes (flywheel)

- Failure modes observed: The PowerShell scaffold script crashed on a 3-argument `Join-Path` (PS 5.1 limitation) after creating the branch + spec template but before creating the prompts dir; recovered by creating the prompts dir manually.
- Graders run and results (PASS/FAIL): Spec quality checklist — PASS (all items).
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): Patch `create-new-feature.ps1` to use nested `Join-Path` calls so it runs cleanly on Windows PowerShell 5.1.
