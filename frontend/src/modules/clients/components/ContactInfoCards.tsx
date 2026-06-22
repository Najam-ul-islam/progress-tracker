import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Client } from "@/modules/clients/types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Field({ label, value }: { label: string; value: string | null }) {
  const provided = value != null && value.trim().length > 0;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={provided ? "mt-1 text-sm text-slate-900" : "mt-1 text-sm italic text-slate-400"}>
        {provided ? value : "Not provided"}
      </dd>
    </div>
  );
}

export function ContactInfoCards({ client }: { client: Client }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-slate-900">Identity</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" value={client.name} />
            <Field label="Company" value={client.companyName} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" value={client.email} />
            <Field label="Phone" value={client.phone} />
            <div className="sm:col-span-2">
              <Field label="Address" value={client.address} />
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
        </CardHeader>
        <CardContent>
          <Field label="Notes" value={client.notes} />
        </CardContent>
      </Card>

      <dl className="grid grid-cols-1 gap-4 px-1 text-xs text-slate-500 sm:grid-cols-2">
        <div>
          <dt className="font-medium uppercase tracking-wide">Created</dt>
          <dd className="mt-1">{formatDate(client.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-medium uppercase tracking-wide">Updated</dt>
          <dd className="mt-1">{formatDate(client.updatedAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
