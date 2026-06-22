import {
  ChartContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "@/components/ui/chart";
import { CHART_COLORS } from "@/components/ui/chart-colors";
import { formatCurrency } from "@/lib/format";
import type { FinancialTotals } from "@/modules/reporting/types";

// Visualises how invoiced revenue splits into the company reserve vs. the
// developer share. Presentational — the page also renders the same numbers in
// the totals cards / table (the accessible source of truth).
export function RevenueCompositionChart({ totals }: { totals: FinancialTotals }) {
  const data = [
    { name: "Company reserve", value: Number(totals.company_share) },
    { name: "Developer share", value: Number(totals.developer_share) },
  ];

  return (
    <ChartContainer ariaLabel="Revenue composition: company reserve versus developer share">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        <Legend />
      </PieChart>
    </ChartContainer>
  );
}
