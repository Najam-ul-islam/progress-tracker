import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingDeadlines } from "@/modules/developer/hooks/useUpcomingDeadlines";
import { EmptyState } from "@/modules/reporting/components/EmptyState";

export function UpcomingDeadlines() {
  const deadlinesQuery = useUpcomingDeadlines();

  if (deadlinesQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (deadlinesQuery.isError) {
    return (
      <Card>
        <CardContent>
          <EmptyState title="Couldn't load deadlines" message="Try refreshing the page." />
        </CardContent>
      </Card>
    );
  }

  const items = deadlinesQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            title="No upcoming deadlines"
            message="All assigned modules have no deadlines set."
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <DeadlineItem key={item.moduleId} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface DeadlineItemProps {
  item: {
    moduleName: string;
    projectName: string;
    deadline: Date | null;
    isOverdue: boolean;
    daysRemaining: number | null;
  };
}

function DeadlineItem({ item }: DeadlineItemProps) {
  const { moduleName, projectName, deadline, isOverdue, daysRemaining } = item;

  const deadlineText = deadline
    ? deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "No deadline set";

  const remainingText = isOverdue
    ? `${Math.abs(daysRemaining ?? 0)} days overdue`
    : daysRemaining !== null
      ? `${daysRemaining} days left`
      : null;

  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <div>
        <div className="font-medium text-slate-900">{moduleName}</div>
        <div className="text-xs text-slate-500">{projectName}</div>
      </div>
      <div className="text-right">
        <div className={isOverdue ? "font-medium text-red-600" : "text-slate-600"}>
          {deadlineText}
        </div>
        {remainingText && (
          <div className={`text-xs ${isOverdue ? "text-red-500" : "text-slate-500"}`}>
            {remainingText}
          </div>
        )}
      </div>
    </div>
  );
}