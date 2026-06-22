import {
  ChartContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "@/components/ui/chart";
import { CHART_COLORS } from "@/components/ui/chart-colors";
import { formatCurrency } from "@/lib/format";
import type { DeveloperReportRow } from "@/modules/reporting/types";

// Visualises total earnings (paid + pending) per developer. Presentational —
// the page table lists the same figures (the accessible source of truth).
export function DeveloperEarningsChart({ developers }: { developers: DeveloperReportRow[] }) {
  const data = developers.map((d) => ({
    name: d.name,
    total: Number(d.earnings.total),
  }));

  return (
    <ChartContainer ariaLabel="Total earnings by developer">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={(v) => formatCurrency(Number(v))} />
        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        <Bar dataKey="total" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
