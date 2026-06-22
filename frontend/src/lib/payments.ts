// Canonical payment/revenue constants — single source of truth on the frontend.
//
// These mirror the backend domain rules so display logic never re-derives the
// split with magic numbers:
//   - Company reserve = 30% of an invoiced amount  (backend: payments/service.py _COMPANY_PCT)
//   - Developer pool   = 70% of an invoiced amount  (backend: payments/service.py _DEVELOPER_PCT)
//
// The advance window (30%–50% of project total) is enforced on the frontend
// advance-payment form per the product rule. The backend activation gate
// enforces the matching 30% floor (projects/service.py _ADVANCE_MIN_PCT); it has
// no upper bound, so paying more than 50% up front never blocks activation.

export const COMPANY_RESERVE_PCT = 0.3;
export const DEVELOPER_POOL_PCT = 0.7;

export const ADVANCE_MIN_PCT = 0.3;
export const ADVANCE_MAX_PCT = 0.5;

/** Company reserve (30%) projected from an invoiced/total amount. */
export function companyReserve(total: number): number {
  return total * COMPANY_RESERVE_PCT;
}

/** Developer pool (70%) projected from an invoiced/total amount. */
export function developerPool(total: number): number {
  return total * DEVELOPER_POOL_PCT;
}

/** Inclusive advance bounds [30%, 50%] for a project total. */
export function advanceBounds(total: number): { min: number; max: number } {
  return { min: total * ADVANCE_MIN_PCT, max: total * ADVANCE_MAX_PCT };
}

/** True when `amount` falls within the inclusive 30%–50% advance window. */
export function isWithinAdvanceWindow(amount: number, total: number): boolean {
  if (!(total > 0)) return false;
  const { min, max } = advanceBounds(total);
  return amount >= min && amount <= max;
}
