import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDeleteClient } from "@/modules/clients/hooks/useDeleteClient";
import { canDeleteClients } from "@/lib/rbac";
import { selectRole, useSessionStore } from "@/modules/auth/store/session.store";
import { ClientsApiError, type Client } from "@/modules/clients/types";

type DeleteClientDialogProps = {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteClientDialog({ client, open, onOpenChange, onDeleted }: DeleteClientDialogProps) {
  const role = useSessionStore(selectRole);
  const allowed = canDeleteClients(role);
  const mutation = useDeleteClient();
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form error when the dialog opens or the target changes.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevClientId, setPrevClientId] = useState(client?.id);
  if (open !== prevOpen || client?.id !== prevClientId) {
    setPrevOpen(open);
    setPrevClientId(client?.id);
    if (open) setFormError(null);
  }

  if (!allowed || !client) return null;

  async function onConfirm() {
    if (!client) return;
    setFormError(null);
    try {
      await mutation.mutateAsync(client.id);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      if (err instanceof ClientsApiError) {
        setFormError(err.message);
      } else {
        setFormError("Something went wrong");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete client</DialogTitle>
          <DialogDescription>
            Delete <span className="font-medium text-slate-900">{client.name}</span>? They will be
            removed from the active clients list. This cannot be undone here.
          </DialogDescription>
        </DialogHeader>
        {formError ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {formError}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
