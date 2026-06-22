import { cn } from "@/lib/cn";

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const cappedValue = Math.min(100, Math.max(0, value));
  
  return (
    <div className={cn("h-2 w-full rounded-full bg-slate-100 overflow-hidden", className)}>
      <div
        className="h-full bg-indigo-600 transition-all duration-300"
        style={{ width: `${cappedValue}%` }}
        role="progressbar"
        aria-valuenow={cappedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
