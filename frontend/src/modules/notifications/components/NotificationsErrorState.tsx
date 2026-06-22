import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type NotificationsErrorStateProps = {
  variant: "dropdown" | "page";
  onRetry: () => void;
};

export function NotificationsErrorState({ variant, onRetry }: NotificationsErrorStateProps) {
  return (
    <div
      data-testid="notifications-error"
      role="alert"
      className="flex flex-col items-center gap-2 px-4 py-8 text-center"
    >
      <AlertCircle className="h-7 w-7 text-red-400" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-700">Couldn't load notifications</p>
      <p className="text-xs text-slate-400">
        {variant === "dropdown" ? "Something went wrong." : "Please check your connection and try again."}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
        Try again
      </Button>
    </div>
  );
}
