import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { cn } from "@/lib/cn";

// Thin, centralized wrapper around Recharts so analytics views never import the
// charting library directly. Swapping libraries later touches only this file.
//
// Charts are PRESENTATIONAL. Every consumer must also render an accessible
// text/table equivalent of the same data (the rendered table or a
// visually-hidden summary) — see the analytics pages.

export type ChartContainerProps = {
  /** Accessible description of what the chart depicts (rendered as a hidden label). */
  ariaLabel: string;
  className?: string;
  height?: number;
  children: React.ReactElement;
};

/** Responsive, fixed-height frame for any chart with an accessible label. */
export function ChartContainer({
  ariaLabel,
  className,
  height = 280,
  children,
}: ChartContainerProps) {
  return (
    <div
      className={cn("w-full", className)}
      role="img"
      aria-label={ariaLabel}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// Re-export the Recharts primitives the analytics charts compose with, so pages
// import everything chart-related from this one module.
export {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
};
