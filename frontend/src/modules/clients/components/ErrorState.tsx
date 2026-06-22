import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-900"
    >
      <h2 className="font-semibold">{title}</h2>
      {message ? <p className="mt-1 text-red-800">{message}</p> : null}
      {onRetry ? (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
