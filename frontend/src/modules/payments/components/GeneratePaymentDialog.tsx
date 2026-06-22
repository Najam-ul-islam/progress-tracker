import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { generatePayment, getRemainingBalance } from "../api";
import {
  paymentGenerateSchema,
  makeAdvancePaymentSchema,
  type PaymentGenerateValues,
} from "../schemas/payment-form.schema";
import { PROJECTS_QUERY_KEYS } from "@/modules/projects/services/projects.api";
import { formatCurrency } from "@/lib/format";
import { advanceBounds, ADVANCE_MIN_PCT, ADVANCE_MAX_PCT } from "@/lib/payments";

interface GeneratePaymentDialogProps {
  projectId: number;
  projectTotalAmount?: string | number;
  /** When "pending", the advance window (30%–50%) is enforced on the amount. */
  projectStatus?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratePaymentDialog({ projectId, projectTotalAmount, projectStatus, open, onOpenChange }: GeneratePaymentDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const total = projectTotalAmount
    ? typeof projectTotalAmount === "string"
      ? parseFloat(projectTotalAmount)
      : projectTotalAmount
    : 0;
  const enforceAdvanceWindow = projectStatus === "pending" && total > 0;
  const bounds = advanceBounds(total);
  const minPct = Math.round(ADVANCE_MIN_PCT * 100);
  const maxPct = Math.round(ADVANCE_MAX_PCT * 100);

  const { data: balanceData, isLoading: isLoadingBalance } = useQuery({
    queryKey: ["payments", "remaining-balance", projectId],
    queryFn: () => getRemainingBalance(projectId),
    enabled: open,
  });

  const form = useForm<PaymentGenerateValues>({
    resolver: zodResolver(
      enforceAdvanceWindow ? makeAdvancePaymentSchema(total) : paymentGenerateSchema
    ),
    defaultValues: {
      totalAmount: "",
      markAsPaid: false,
    },
  });

  useEffect(() => {
    // Pending projects need a 30–50% advance: default to the 50% maximum so the
    // amount clears the backend activation gate. Otherwise prefill the balance.
    if (enforceAdvanceWindow) {
      form.setValue("totalAmount", bounds.max.toFixed(2));
    } else if (balanceData) {
      form.setValue("totalAmount", balanceData.remaining_balance);
    }
  }, [balanceData, form, enforceAdvanceWindow, bounds.max]);

  const mutation = useMutation({
    mutationFn: (data: { amount: number; markAsPaid: boolean }) =>
      generatePayment(projectId, {
        total_amount: data.amount,
        mark_as_paid: data.markAsPaid,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.progress(projectId) });
      queryClient.invalidateQueries({ queryKey: ["payments", "remaining-balance", projectId] });
      queryClient.invalidateQueries({ queryKey: ["reports", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports", "payments"] });
      onOpenChange(false);
      form.reset();
    },
onError: (err: { response?: { data?: { detail?: string } } }) => {
       setFormError(err.response?.data?.detail || "Failed to generate payment");
     },
  });

  async function onSubmit(values: PaymentGenerateValues) {
    setFormError(null);
    await mutation.mutateAsync({
      amount: parseFloat(values.totalAmount),
      // A collected advance is money the client has paid, so it is recorded as
      // paid immediately and counts toward the 30% activation gate.
      markAsPaid: enforceAdvanceWindow ? true : values.markAsPaid,
    });
  }

  const setAdvance = (amount: number) => {
    form.setValue("totalAmount", amount.toFixed(2), { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{enforceAdvanceWindow ? "Generate Advance Payment" : "Generate Payment"}</DialogTitle>
          <DialogDescription>
            {enforceAdvanceWindow
              ? `Collect the client advance before the project starts. Must be ${minPct}%–${maxPct}% of the total.`
              : "Create a new payment distribution for this project."}
          </DialogDescription>
          {balanceData && (
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-sm text-slate-500">
                Remaining balance: <strong>{formatCurrency(balanceData.remaining_balance)}</strong>
              </p>
              {enforceAdvanceWindow && (
                <>
                  <p className="text-xs text-slate-500">
                    Advance range: <strong>{formatCurrency(bounds.min)} – {formatCurrency(bounds.max)}</strong>
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="link"
                      className="text-xs h-auto p-0 w-fit text-indigo-600 font-medium"
                      onClick={() => setAdvance(bounds.min)}
                    >
                      Set {minPct}% ({formatCurrency(bounds.min)})
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      className="text-xs h-auto p-0 w-fit text-indigo-600 font-medium"
                      onClick={() => setAdvance(bounds.max)}
                    >
                      Set {maxPct}% ({formatCurrency(bounds.max)})
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount ($)</FormLabel>
                  <FormControl>
                    <Input placeholder="0.00" {...field} disabled={isLoadingBalance} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {enforceAdvanceWindow ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                This advance is recorded as <strong>paid</strong> and will count toward the 30% required to activate the project.
              </p>
            ) : (
              <FormField
                control={form.control}
                name="markAsPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Mark as Paid Immediately</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {formError && (
              <p className="text-sm font-medium text-red-600">{formError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || isLoadingBalance}>
                {mutation.isPending
                  ? "Generating..."
                  : enforceAdvanceWindow
                    ? "Collect Advance"
                    : "Generate Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
