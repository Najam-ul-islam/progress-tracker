import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppHeader } from "@/modules/auth/components/AppHeader";
import { RequireClientsAccess } from "@/modules/clients/components/RequireClientsAccess";
import { ClientsFilters } from "@/modules/clients/components/ClientsFilters";
import { ClientsTable } from "@/modules/clients/components/ClientsTable";
import { ClientFormDialog } from "@/modules/clients/components/ClientFormDialog";
import { DeleteClientDialog } from "@/modules/clients/components/DeleteClientDialog";
import { EmptyState } from "@/modules/clients/components/EmptyState";
import { ErrorState } from "@/modules/clients/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useClientsList } from "@/modules/clients/hooks/useClientsList";
import { useFilteredClients } from "@/modules/clients/hooks/useFilteredClients";
import { parseFilter, filterToParams, DEFAULT_FILTER } from "@/modules/clients/schemas/clients-filter.schema";
import { canEditClients, canDeleteClients } from "@/lib/rbac";
import { selectRole, useSessionStore } from "@/modules/auth/store/session.store";
import type { Client } from "@/modules/clients/types";

function ListSkeleton() {
  return (
    <div className="space-y-2" data-testid="clients-list-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function ClientsListPageBody() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams);
  const query = useClientsList();
  const filtered = useFilteredClients(query.data, filter);
  const hasSearch = filter.q.trim().length > 0;

  const role = useSessionStore(selectRole);
  const canEdit = canEditClients(role);
  const canDelete = canDeleteClients(role);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  function clearSearch() {
    setSearchParams(filterToParams(DEFAULT_FILTER), { replace: true });
  }

  let body: React.ReactNode;
  if (query.isPending) {
    body = <ListSkeleton />;
  } else if (query.isError) {
    body = (
      <ErrorState message="We couldn't load the clients list." onRetry={() => query.refetch()} />
    );
  } else if (filtered.length === 0) {
    body = hasSearch ? (
      <EmptyState
        title="No clients match your search"
        action={
          <Button variant="secondary" size="sm" onClick={clearSearch}>
            Clear search
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No clients yet"
        message="Clients you add will appear here."
        action={
          canEdit ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New client
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <ClientsTable
        clients={filtered}
        onEdit={(c) => setEditing(c)}
        onDelete={(c) => setDeleting(c)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-500">Manage client contact details.</p>
          </div>
          {canEdit ? <Button onClick={() => setCreateOpen(true)}>New client</Button> : null}
        </div>
        <ClientsFilters />
        {body}
      </main>

      {canEdit ? (
        <>
          <ClientFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
          {editing ? (
            <ClientFormDialog
              mode="edit"
              client={editing}
              open={editing !== null}
              onOpenChange={(open) => {
                if (!open) setEditing(null);
              }}
            />
          ) : null}
        </>
      ) : null}
      {canDelete && deleting ? (
        <DeleteClientDialog
          client={deleting}
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

export function ClientsListPage() {
  return (
    <RequireClientsAccess>
      <ClientsListPageBody />
    </RequireClientsAccess>
  );
}
