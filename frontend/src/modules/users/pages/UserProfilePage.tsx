import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "@/modules/auth/components/AppHeader";
import { UserProfileCard } from "@/modules/users/components/UserProfileCard";
import { AccessDenied } from "@/modules/users/components/AccessDenied";
import { EmptyState } from "@/modules/users/components/EmptyState";
import { ErrorState } from "@/modules/users/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { IfAdmin } from "@/modules/users/components/IfRole";
import { EditUserDialog } from "@/modules/users/components/EditUserDialog";
import { useUser } from "@/modules/users/hooks/useUser";
import { canViewUserProfile } from "@/lib/rbac";
import { selectRole, useSessionStore } from "@/modules/auth/store/session.store";
import { UsersApiError } from "@/modules/users/types";

function ProfileSkeleton() {
  return (
    <div className="space-y-3" data-testid="user-profile-skeleton">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const isValidId = !Number.isNaN(id);
  const role = useSessionStore(selectRole);
  const sessionUserId = useSessionStore((s) => s.user?.id ?? null);
  const allowed = isValidId && canViewUserProfile(role, sessionUserId, id);

  const query = useUser(id, { enabled: allowed });
  const [editOpen, setEditOpen] = useState(false);

  let body: React.ReactNode;
  if (!isValidId) {
    body = (
      <EmptyState
        title="User not found"
        message="That user id is not valid."
        action={
          <Link
            to="/users"
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
          >
            Back to users
          </Link>
        }
      />
    );
  } else if (!allowed) {
    body = <AccessDenied />;
  } else if (query.isPending) {
    body = <ProfileSkeleton />;
  } else if (query.isError) {
    const err = query.error;
    if (err instanceof UsersApiError && err.code === "not_found") {
      body = (
        <EmptyState
          title="User not found"
          message="That user no longer exists."
          action={
            <Link
              to="/users"
              className="inline-flex h-9 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
            >
              Back to users
            </Link>
          }
        />
      );
    } else if (err instanceof UsersApiError && err.code === "forbidden") {
      body = <AccessDenied />;
    } else {
      body = (
        <ErrorState
          message="We couldn't load this profile."
          onRetry={() => query.refetch()}
        />
      );
    }
  } else {
    body = (
      <>
        <div className="flex items-center justify-between">
          <Link to="/users" className="text-sm text-slate-500 hover:text-slate-900">
            ← Back to users
          </Link>
          <IfAdmin>
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Edit user
            </Button>
          </IfAdmin>
        </div>
        <UserProfileCard user={query.data} />
        <EditUserDialog
          user={query.data}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
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
