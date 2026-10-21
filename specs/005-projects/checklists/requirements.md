# Specification Quality Checklist: Projects Management

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-04
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

- The spec deliberately references prior-feature artefacts (the
  `auth.dependencies` from feature 002; the `users.repository` and `User`
  entity from feature 003; the `Client` entity and clients-soft-delete
  pattern from feature 004) as **contractual continuities**, not
  implementation details. The closed-schema rule (FR-018), the soft-delete
  pattern (FR-024 / FR-026), and the 401-then-403-then-404-then-422
  ordering are all reused by reference.

- The **share-cap rule is dual-gate**: the cap (sum ≤ 70.00) is enforced on
  every write (FR-010), AND equality with 70.00 is required to manually
  activate the project (FR-013). Rationale captured in spec "Resolved
  decisions" §1: a single rule (cap-only) would let a project be activated
  with under-allocated modules, which would defeat the 70/30 distribution
  invariant; a single rule (equal-only) would force the operator to add
  modules in exact-fit order. Dual-gate preserves both.

- **Status flow is hybrid**: `pending → active` is manual via
  `PATCH /projects/{id} {status:"active"}` and gated on the share=70 check;
  `active → completed` is automatic the moment every active module hits 100
  (FR-014). `status:"completed"` is NEVER accepted from any client — the
  schema's `status` field is `Literal["active"]` only. This is a deliberate
  choice (Resolved decisions §3): humans set the start, math sets the end.

- **Soft-delete on both entities** mirrors feature 004's clients pattern
  (Resolved decisions §2). Hard delete is rejected because (a) future
  payment rows will FK to `project.id` and `project_module.id` and we never
  want orphans; (b) restoring a hard-deleted row is irrecoverable; (c) the
  audit trail of "this work happened" is a load-bearing artefact for billing
  reconciliation, not just history.

- **Developer ownership of progress** is enforced inside the service layer
  (FR-019), not in `Depends`. Reason: the rule is data-dependent — the
  identity of the assigned developer is on the row, not on the request. The
  `Depends(get_current_user)` gate provides authentication; the per-row
  ownership check is `assigned_developer_id == current_user.id`. Admins and
  managers bypass this check and may patch any module.

- **Visibility filter for developers** (FR-008) returns **404, not 403**,
  for projects the developer is not assigned to. Rationale: 403 would leak
  the existence of an id; 404 keeps the existence opaque. This matches
  GitHub's "private-repo-as-404" pattern and is consistent with the
  generic-body rule for non-existent ids (FR-026).

- **Decimal arithmetic on the wire**: `total_amount`, `company_share`,
  `developer_share`, and `share_percentage` are serialised as JSON strings
  (e.g., `"30.00"`), not numbers. Rationale: JSON `number` is IEEE 754 and
  rounding errors are unacceptable for money or for the cap-equality check.
  Reflected in the OpenAPI schemas (`type: string`).

- **Progress aggregation is a simple arithmetic mean**, not share-weighted
  (FR-022). Rationale: `progress` is the developer's reported completion of
  their own slice; the share-weighting concern belongs in the future
  payments module. Keeping the aggregator simple avoids conflating
  "operational progress" with "earned distribution."

- **Auto-completion fires at most once per lifecycle**. Once `status =
  "completed"`, the project rejects every subsequent module mutation
  (FR-016) and every progress write (FR-021). There is no path to flip
  back to `active` short of a future restoration slice — explicitly out of
  scope (Edge Cases).

- **Phone, email, and uniqueness from feature 004 do not apply here.**
  Neither `project` nor `project_module` has a natural-key column requiring
  uniqueness; the 70%-cap is a sum constraint and lives in the service
  layer, not in any DB unique index.

- Items marked incomplete in the lists above would require spec updates
  before `/sp.plan` proceeded. All items are checked.
