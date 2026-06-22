import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "@/modules/auth/components/AppHeader";
import { ContactInfoCards } from "@/modules/clients/components/ContactInfoCards";
import { ClientFormDialog } from "@/modules/clients/components/ClientFormDialog";
import { DeleteClientDialog } from "@/modules/clients/components/DeleteClientDialog";
import { AccessDenied } from "@/modules/clients/components/AccessDenied";
import { EmptyState } from "@/modules/clients/components/EmptyState";
import { ErrorState } from "@/modules/clients/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useClient } from "@/modules/clients/hooks/useClient";
import { canViewClients, canEditClients, canDeleteClients } from "@/lib/rbac";
import { selectRole, useSessionStore } from "@/modules/auth/store/session.store";
import { ClientsApiError } from "@/modules/clients/types";

function DetailsSkeleton() {
  return (
    <div className="space-y-3" data-testid="client-details-skeleton">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/clients"
      className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
    >
      Back to clients
    </Link>
  );
}

export function ClientDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const isValidId = !Number.isNaN(id);
  const role = useSessionStore(selectRole);
  const allowed = isValidId && canViewClients(role);
  const canEdit = canEditClients(role);
  const canDelete = canDeleteClients(role);
  const navigate = useNavigate();

  const query = useClient(id, { enabled: allowed });
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  let body: React.ReactNode;
  if (!canViewClients(role)) {
    body = <AccessDenied />;
  } else if (!isValidId) {
    body = (
      <EmptyState title="Client not found" message="That client id is not valid." action={<BackLink />} />
    );
  } else if (query.isPending) {
    body = <DetailsSkeleton />;
  } else if (query.isError) {
    const err = query.error;
    if (err instanceof ClientsApiError && err.code === "not_found") {
      body = (
        <EmptyState
          title="Client not found"
          message="That client no longer exists."
          action={<BackLink />}
        />
      );
    } else if (err instanceof ClientsApiError && err.code === "forbidden") {
      body = <AccessDenied />;
    } else {
      body = <ErrorState message="We couldn't load this client." onRetry={() => query.refetch()} />;
    }
  } else {
    const client = query.data;
    body = (
      <>
        <div className="flex items-center justify-between">
          <Link to="/clients" className="text-sm text-slate-500 hover:text-slate-900">
            ← Back to clients
          </Link>
          <div className="flex gap-2">
            {canEdit ? (
              <Button size="sm" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
        <ContactInfoCards client={client} />
        {canEdit ? (
          <ClientFormDialog
            mode="edit"
            client={client}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        ) : null}
        {canDelete ? (
          <DeleteClientDialog
            client={client}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onDeleted={() => navigate("/clients")}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 p-6">{body}</main>
    </div>
  );
}
