import { useTheme } from "@/context/ThemeContext";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface ChartDataPoint {
  name: string;
  revenue: number;
  users: number;
  expenses: number;
}

interface MetricsChartProps {
  data: ChartDataPoint[];
  title?: string;
}

export function MetricsChart({ data, title = "Platform Analytics Overview" }: MetricsChartProps) {
  const { theme } = useTheme();

  // Dynamically resolve light/dark colors
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const colors = {
    grid: isDark ? "rgba(51, 65, 85, 0.25)" : "rgba(226, 232, 240, 0.8)",
    text: isDark ? "#94a3b8" : "#64748b",
    tooltipBg: isDark ? "#090d16" : "#ffffff",
    tooltipBorder: isDark ? "#1e293b" : "#e2e8f0",
    revenueGradStart: "rgba(20, 184, 166, 0.25)",
    revenueGradEnd: "rgba(20, 184, 166, 0)",
    revenueStroke: "#14b8a6", // Teal-500
    expensesBar: isDark ? "#1e293b" : "#cbd5e1",
    usersLine: "#0d9488", // Teal-600
  };

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors w-full h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
          {title}
        </h3>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-teal-500 shrink-0" />
            <span>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-800 shrink-0" />
            <span>Expenses</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0" />
            <span>Active Users</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0 text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.revenueStroke} stopOpacity={0.25} />
                <stop offset="95%" stopColor={colors.revenueStroke} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />

            <XAxis
              dataKey="name"
              stroke={colors.text}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />

            {/* Left Y-Axis for Dollars */}
            <YAxis
              yAxisId="left"
              stroke={colors.text}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`}
              dx={-5}
            />

            {/* Right Y-Axis for Users */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={colors.text}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              dx={5}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                borderColor: colors.tooltipBorder,
                borderRadius: "12px",
                color: isDark ? "#ffffff" : "#000000",
                fontSize: "11px",
              }}
              formatter={(value, name) => {
                if (name === "revenue" || name === "expenses") return [`$${Number(value).toLocaleString()}`, name.toUpperCase()];
                return [Number(value).toLocaleString(), "ACTIVE USERS"];
              }}
            />

            {/* Revenue Area (Left Axis) */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke={colors.revenueStroke}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="revenue"
            />

            {/* Expenses Bar (Left Axis) */}
            <Bar
              yAxisId="left"
              dataKey="expenses"
              fill={colors.expensesBar}
              radius={[4, 4, 0, 0]}
              barSize={20}
              name="expenses"
            />

            {/* Users Line (Right Axis) */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="users"
              stroke={colors.usersLine}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
              name="users"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
