import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

export interface KPICardProps {
  label: string;
  value?: string | number;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  description?: string;
  sparkline?: number[];
  isLoading?: boolean;
  isEmpty?: boolean;
}

const trendConfig = {
  up: {
    icon: TrendingUp,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
    stroke: "#10b981",
    fill: "rgba(16,185,129,0.08)",
  },
  down: {
    icon: TrendingDown,
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50",
    stroke: "#f43f5e",
    fill: "rgba(244,63,94,0.08)",
  },
  neutral: {
    icon: Minus,
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/50",
    stroke: "#94a3b8",
    fill: "rgba(148,163,184,0.06)",
  },
};

const formatSparkValue = (val: unknown) => {
  if (typeof val === 'number') return val.toLocaleString();
  return '';
};

export function KPICard({
  label,
  value,
  delta,
  trend = "neutral",
  description,
  sparkline,
  isLoading = false,
  isEmpty = false,
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors">
        <div className="space-y-3">
          <Skeleton className="h-4 w-28 bg-slate-100 dark:bg-slate-800" />
          <Skeleton className="h-9 w-24 bg-slate-100 dark:bg-slate-800" />
          <Skeleton className="h-4 w-40 bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xs">No data available</p>
      </div>
    );
  }

  const cfg = trendConfig[trend];
  const TrendIcon = cfg.icon;

  const sparkData = sparkline?.map((v, i) => ({ i, v })) ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-[var(--accent)] opacity-80 group-hover:opacity-100 transition-opacity" />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </p>

        <div className="flex items-end justify-between gap-3">
          <span className="text-[26px] font-extrabold text-slate-900 dark:text-white tracking-tight font-heading tabular-nums leading-none">
            {value}
          </span>

          {delta && (
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border",
              cfg.badge
            )}>
              <TrendIcon className="w-3 h-3" />
              {delta}
            </span>
          )}
        </div>

        {sparkData.length > 2 && (
          <div className="mt-1 h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip
                  isAnimationActive={false}
                  contentStyle={{
                    background: "rgba(15,23,42,0.9)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "11px",
                    padding: "6px 10px",
                  }}
                  labelFormatter={() => ""}
                  formatter={(value) => [formatSparkValue(value), '']}
                />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={cfg.stroke}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  fill="url(#sparkGradient)"
                  animationDuration={800}
                />
                <defs>
                  <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cfg.fill} />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
