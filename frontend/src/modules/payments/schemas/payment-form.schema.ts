import { z } from "zod";
import { ADVANCE_MIN_PCT, ADVANCE_MAX_PCT, advanceBounds } from "@/lib/payments";

export const paymentGenerateSchema = z.object({
  totalAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Amount must be a positive number"),
  markAsPaid: z.boolean(),
});

export type PaymentGenerateValues = z.infer<typeof paymentGenerateSchema>;

/**
 * Schema variant that also enforces the advance window (30%–50% of the project
 * total). Used when generating the up-front advance on a pending project; the
 * unconstrained `paymentGenerateSchema` is used for ad-hoc billing afterwards.
 */
export function makeAdvancePaymentSchema(projectTotal: number) {
  const { min, max } = advanceBounds(projectTotal);
  const minPct = Math.round(ADVANCE_MIN_PCT * 100);
  const maxPct = Math.round(ADVANCE_MAX_PCT * 100);
  return paymentGenerateSchema.superRefine((values, ctx) => {
    const num = parseFloat(values.totalAmount);
    if (isNaN(num) || !(projectTotal > 0)) return;
    if (num < min || num > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalAmount"],
        message: `Advance must be between ${minPct}% and ${maxPct}% of the total (${min.toFixed(2)}–${max.toFixed(2)}).`,
      });
    }
  });
}

export const defaultPaymentValues: PaymentGenerateValues = {
  totalAmount: "",
  markAsPaid: false,
};
