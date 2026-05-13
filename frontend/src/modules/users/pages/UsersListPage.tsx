import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppHeader } from "@/modules/auth/components/AppHeader";
import { RequireUsersAccess } from "@/modules/users/components/RequireUsersAccess";
import { UsersFilters } from "@/modules/users/components/UsersFilters";
import { UsersTable } from "@/modules/users/components/UsersTable";
import { EmptyState } from "@/modules/users/components/EmptyState";
import { ErrorState } from "@/modules/users/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useUsersList } from "@/modules/users/hooks/useUsersList";
import { useFilteredUsers } from "@/modules/users/hooks/useFilteredUsers";
import { parseFilter, filterToParams, DEFAULT_FILTER } from "@/modules/users/schemas/users-filter.schema";
import { EditUserDialog } from "@/modules/users/components/EditUserDialog";
import type { User } from "@/modules/users/types";

function ListSkeleton() {
  return (
    <div className="space-y-2" data-testid="users-list-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function UsersListPageBody() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams);
  const query = useUsersList();
  const filtered = useFilteredUsers(query.data, filter);
  const [editing, setEditing] = useState<User | null>(null);

  function clearFilters() {
    setSearchParams(filterToParams(DEFAULT_FILTER), { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Manage roles, status, and profiles.</p>
        </div>
        <UsersFilters />
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorState
            message="We couldn't load the users list."
            onRetry={() => query.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No users match these filters"
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <UsersTable users={filtered} onEdit={(u) => setEditing(u)} />
        )}
      </main>
      <EditUserDialog
        user={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

export function UsersListPage() {
  return (
    <RequireUsersAccess>
      <UsersListPageBody />
    </RequireUsersAccess>
  );
}
