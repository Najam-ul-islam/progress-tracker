import { Loader2 } from "lucide-react";
import { useSessionStore } from "@/modules/auth/store/session.store";

type Props = { children: React.ReactNode };

export function HydrationGate({ children }: Props) {
  const hydrated = useSessionStore((s) => s.hydrated);
  if (!hydrated) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-slate-50"
      >
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
