# Access Control Matrix: Payments Distribution

**Feature**: `006-payments-distribution`
**Date**: 2026-05-07
**Status**: Complete

## Role × Endpoint matrix

| Endpoint                              | Anonymous | Developer       | Manager     | Admin       |
| ------------------------------------- | --------- | --------------- | ----------- | ----------- |
| `POST /payments/generate/{project_id}`| 401       | 403             | ✅ allow    | ✅ allow    |
| `GET /payments`                       | 401       | 403             | ✅ allow    | ✅ allow    |
| `GET /payments/{id}`                  | 401       | 403             | ✅ allow    | ✅ allow    |
| `GET /payments/developer/me`          | 401       | ✅ allow (own)  | 403         | 403         |
| `PATCH /payments/{id}/status`         | 401       | 403             | 403         | ✅ allow    |
| `GET /payments/summary`               | 401       | 403             | ✅ allow    | ✅ allow    |

**Read note** for `GET /payments/developer/me`: a developer caller sees
**only** rows whose `developer_id == caller.id`. The filter lives in the
service-layer query; there is no path through which one developer can
read another developer's amounts (FR-008).

## Guard ordering (FR-016 — continuity from features 003/004/005)

Every endpoint evaluates guards in this exact order:

1. **401 Unauthorized** — missing or invalid `Authorization` header.
   Enforced by `Depends(get_current_user)`.
2. **403 Forbidden** — authenticated but role is not in the allow-list
   for this endpoint. Enforced by `Depends(require_admin)` /
   `Depends(require_any("admin", "manager"))` /
   `Depends(require_role("developer"))`.
3. **404 Not Found** — missing target row (Payment, project, developer
   payment). Enforced by the service layer raising
   `PaymentNotFound` / `ProjectNotFound`.
4. **422 Unprocessable Entity** — payload validation, business-rule
   violations (project not active|completed; share-sum drift; mutually
   exclusive fields both supplied; unknown fields). Enforced by Pydantic
   schemas (`extra="forbid"`) and by service-layer typed exceptions.

The ordering is **not negotiable**. Tests cover the 401-vs-403 ordering
explicitly (an unauthenticated developer-shaped request must receive
401, not 403).

## Service-layer typed exceptions → HTTP

| Exception                                | HTTP | Detail                                                  |
| ---------------------------------------- | ---- | ------------------------------------------------------- |
| `ProjectNotFound`                        | 404  | `"project not found"`                                   |
| `ProjectNotBillable`                     | 422  | `"project is not yet active"`                           |
| `ShareSumDrift`                          | 422  | `"module shares no longer sum to 70.00"`                |
| `PaymentNotFound`                        | 404  | `"payment not found"`                                   |
| `DeveloperPaymentNotInThisPayment`       | 422  | `"developer_payment_id does not belong to this payment"`|
| `MutuallyExclusiveFields`                | 422  | `"developer_payment_id and target are mutually exclusive"` |
| `EmptyStatusPatchBody`                   | 422  | `"must specify either developer_payment_id or target"`  |
| `InvalidTotalAmount`                     | 422  | `"total_amount must be greater than zero"`              |

## RBAC source-of-truth

All RBAC decisions are sourced from the `User.role` column populated by
feature 002. The payments module imports only:

- `auth.dependencies.get_current_user`
- `auth.dependencies.require_admin`
- `auth.dependencies.require_any`
- `auth.dependencies.require_role`

It MUST NOT import `auth.service`, `auth.repository`, or `auth.schema`
(beyond the public Pydantic types) for RBAC decisions. The audit script
`audit_payments_imports.sh` enforces this allow-list.

## Why developer self-service is its own endpoint

The developer view (`GET /payments/developer/me`) returns a **flat list
of child rows** with denormalised `project_id` for navigation. The
admin/manager view (`GET /payments/{id}`) returns a **nested
PaymentDetailRead** with the full company-reserve / developer-breakdown
shape.

The two shapes are incompatible: the developer view must never expose
`company_amount`, `total_amount`, or other developers' rows (FR-008).
Rather than overload `GET /payments/{id}` with branching response
shapes by role (a footgun: one bug in the role check leaks the company
reserve), the spec uses two distinct endpoints. Developers receive 403
on the aggregate endpoints; admin/manager receive 403 on the
developer-scoped endpoint.

This mirrors the pattern feature 005 used for `GET /projects/{id}`
(developer-visible only when assigned) but takes it further: instead of
filtering response fields, payments **uses different endpoints** because
the field set is structurally different, not just filtered.
