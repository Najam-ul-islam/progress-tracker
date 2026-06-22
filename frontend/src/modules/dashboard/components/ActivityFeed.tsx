import { formatRelativeTime } from "@/lib/format";
import { CreditCard, ShieldAlert, Cpu, User, Activity } from "lucide-react";
import { cn } from "@/lib/cn";
import { type ActivityEvent } from "../services/mockData";

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  const getCategoryConfig = (category: ActivityEvent["category"]) => {
    switch (category) {
    case "billing":
      return {
        icon: CreditCard,
        bgClass: "bg-teal-50 dark:bg-teal-950/30",
        iconClass: "text-teal-600 dark:text-teal-400",
      };
      case "security":
        return {
          icon: ShieldAlert,
          bgClass: "bg-rose-50 dark:bg-rose-950/30",
          iconClass: "text-rose-600 dark:text-rose-400",
        };
      case "system":
        return {
          icon: Cpu,
          bgClass: "bg-amber-50 dark:bg-amber-950/30",
          iconClass: "text-amber-600 dark:text-amber-400",
        };
      case "user":
        return {
          icon: User,
          bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
          iconClass: "text-emerald-600 dark:text-emerald-400",
        };
      default:
        return {
          icon: Activity,
          bgClass: "bg-slate-50 dark:bg-slate-800",
          iconClass: "text-slate-655 dark:text-slate-400",
        };
    }
  };

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors h-full">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-5 tracking-tight">
        Recent Activity Events
      </h3>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {events.length > 0 ? (
          events.map((event) => {
            const config = getCategoryConfig(event.category);
            const IconComponent = config.icon;

            return (
              <div key={event.id} className="flex items-start gap-3.5 group">
                {/* Icon wrapper */}
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-transform group-hover:scale-105",
                    config.bgClass
                  )}
                >
                  <IconComponent className={cn("w-4.5 h-4.5", config.iconClass)} />
                </div>

                {/* Event text content */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {event.user.name}
                    </span>{" "}
                    {event.action}
                  </p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 text-center gap-2">
            <Activity className="w-5 h-5 opacity-40 animate-pulse" />
            <p className="text-xs">No recent events logged</p>
          </div>
        )}
      </div>
    </div>
  );
}
