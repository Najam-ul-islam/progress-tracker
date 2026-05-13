import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-slate-200 bg-slate-100 text-slate-700",
        admin: "border-red-200 bg-red-50 text-red-700",
        manager: "border-amber-200 bg-amber-50 text-amber-700",
        developer: "border-sky-200 bg-sky-50 text-sky-700",
        active: "border-emerald-200 bg-emerald-50 text-emerald-700",
        inactive: "border-slate-200 bg-slate-100 text-slate-500",
        muted: "border-slate-200 bg-white text-slate-500",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
