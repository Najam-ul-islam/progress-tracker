# Specification Quality Checklist: Clients Management

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-03
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/sp.clarify` or
  `/sp.plan`.
- The spec deliberately references prior-feature artefacts (the existing
  `auth.dependencies`, the User entity from feature 003, the byte-identical
  401 envelope from feature 002) without prescribing implementation. These
  are *contractual continuities*, not implementation details.
- The spec promotes "Delete client" to **mandatory soft-delete** even
  though the original brief said "(soft delete optional)". Rationale is
  recorded in the spec under FR-014 and again in `plan.md`'s ADR
  suggestions: a hard delete would orphan future `project.client_id`
  foreign keys, and reactivation can be added later as a dedicated slice
  without reshaping the lifecycle. Reviewers may push back on the
  promotion — keep it as required.
- The spec returns **409 Conflict** for duplicate `email` or `phone`,
  rather than the brief's "duplicate client → 400". Rationale: 400 is
  reserved for malformed syntax; 409 is the canonical REST status for a
  unique-constraint collision and matches feature 003's existing 409
  taxonomy (last-admin guard). Documented in FR-009.
- The spec gives **manager** the create + update surface but **not**
  delete. This intentionally mirrors feature 003's pattern of reserving
  destructive admin-only operations while letting managers operate the
  read/write surface needed for day-to-day work.
- Phone format validation is a **regex** (FR-008), not a library
  (`phonenumbers`). The trade-off — strict format check now vs. true
  E.164 normalisation later — is recorded in the Assumptions section of
  the spec and surfaced as an ADR candidate in `plan.md`.
- Uniqueness applies **only to active rows**. A soft-deleted client frees
  its email and phone for re-use. This is explicitly an Edge Case in the
  spec and is enforced by the partial unique indexes documented in
  `data-model.md` and `research.md` R1.
