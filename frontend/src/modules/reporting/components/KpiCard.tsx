import { Card, CardContent, CardHeader } from "@/components/ui/card";

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
