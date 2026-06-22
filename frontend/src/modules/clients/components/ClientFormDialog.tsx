import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  clientFormSchema,
  clientToFormValues,
  diffDraft,
  emptyFormValues,
  hasChanges,
  type ClientFormValues,
} from "@/modules/clients/schemas/client-form.schema";
import { toCreateBody } from "@/modules/clients/services/clients.api";
import { useCreateClient } from "@/modules/clients/hooks/useCreateClient";
import { useUpdateClient } from "@/modules/clients/hooks/useUpdateClient";
import { canEditClients } from "@/lib/rbac";
import { selectRole, useSessionStore } from "@/modules/auth/store/session.store";
import { ClientsApiError, type Client } from "@/modules/clients/types";

type ClientFormDialogProps =
  | { mode: "create"; client?: null; open: boolean; onOpenChange: (open: boolean) => void }
  | { mode: "edit"; client: Client; open: boolean; onOpenChange: (open: boolean) => void };

// Map a 409 conflict message onto the field it names; fall back to a form alert.
function applyConflict(
  detail: string | undefined,
  setError: (field: keyof ClientFormValues, message: string) => void,
  setFormError: (message: string) => void
) {
  const msg = detail ?? "This change conflicts with an existing client";
  if (/email/i.test(msg)) setError("email", msg);
  else if (/phone/i.test(msg)) setError("phone", msg);
  else setFormError(msg);
}

export function ClientFormDialog(props: ClientFormDialogProps) {
  const { mode, open, onOpenChange } = props;
  const client = props.mode === "edit" ? props.client : null;
  const role = useSessionStore(selectRole);
  const allowed = canEditClients(role);

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const mutation = mode === "create" ? createMutation : updateMutation;
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form error when the dialog opens or the target client changes.
  // We do this during render (adjusting state from props) to avoid the
  // set-state-in-effect lint error.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevClientId, setPrevClientId] = useState(client?.id);
  if (open !== prevOpen || client?.id !== prevClientId) {
    setPrevOpen(open);
    setPrevClientId(client?.id);
    if (open) setFormError(null);
  }

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? clientToFormValues(client) : emptyFormValues,
  });

  // Reset form whenever the dialog target changes (new client to edit, or reopened create).
  useEffect(() => {
    if (open) {
      form.reset(client ? clientToFormValues(client) : emptyFormValues);
    }
  }, [client, mode, open, form]);

  if (!allowed) return null;

  function handleFieldErrors(err: ClientsApiError) {
    if (err.code === "conflict") {
      applyConflict(
        err.detail,
        (field, message) => form.setError(field, { type: "server", message }),
        (message) => setFormError(message)
      );
      return;
    }
    if (err.code === "validation" && err.fieldErrors) {
      const known: (keyof ClientFormValues)[] = [
        "name",
        "email",
        "phone",
        "companyName",
        "address",
        "notes",
      ];
      const wireToForm: Record<string, keyof ClientFormValues> = {
        name: "name",
        email: "email",
        phone: "phone",
        company_name: "companyName",
        address: "address",
        notes: "notes",
      };
      let matched = false;
      for (const [field, message] of Object.entries(err.fieldErrors)) {
        const formField = wireToForm[field];
        if (formField && known.includes(formField)) {
          form.setError(formField, { type: "server", message });
          matched = true;
        }
      }
      if (!matched) setFormError(err.message);
      return;
    }
    setFormError(err.message);
  }

  async function onSubmit(values: ClientFormValues) {
    setFormError(null);
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(toCreateBody(values));
      } else if (client) {
        const draft = diffDraft(client, values);
        if (!hasChanges(draft)) {
          onOpenChange(false);
          return;
        }
        await updateMutation.mutateAsync({ id: client.id, draft });
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ClientsApiError) {
        handleFieldErrors(err);
      } else {
        setFormError("Something went wrong");
      }
    }
  }

  const title = mode === "create" ? "New client" : "Edit client";
  const description =
    mode === "create"
      ? "Add a new client's contact details."
      : "Update this client's contact details.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormDescription>International format, e.g. +1 415 555 0101</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
