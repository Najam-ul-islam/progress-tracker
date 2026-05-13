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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  diffDraft,
  editUserSchema,
  hasChanges,
  ROLE_VALUES,
  userToFormValues,
  type EditUserFormValues,
} from "@/modules/users/schemas/edit-user.schema";
import { useUpdateUser } from "@/modules/users/hooks/useUpdateUser";
import { canEditUsers } from "@/lib/rbac";
import { selectRole, useSessionStore } from "@/modules/auth/store/session.store";
import { UsersApiError, type User } from "@/modules/users/types";

type EditUserDialogProps = {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ROLE_LABEL: Record<(typeof ROLE_VALUES)[number], string> = {
  admin: "Admin",
  manager: "Manager",
  developer: "Developer",
};

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const role = useSessionStore(selectRole);
  const allowed = canEditUsers(role);
  const mutation = useUpdateUser();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: user ? userToFormValues(user) : { name: "", role: "developer", isActive: true },
  });

  // Reset form + error state whenever a new user is opened. We intentionally
  // depend only on `user.id` to avoid loops with mutation/form identities.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user) {
      form.reset(userToFormValues(user));
      setFormError(null);
    }
  }, [user?.id]);

  if (!allowed || !user) return null;

  async function onSubmit(values: EditUserFormValues) {
    if (!user) return;
    setFormError(null);
    const draft = diffDraft(user, values);
    if (!hasChanges(draft)) {
      onOpenChange(false);
      return;
    }
    try {
      await mutation.mutateAsync({ id: user.id, draft });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof UsersApiError) {
        if (err.code === "validation" && err.fieldErrors) {
          for (const [field, message] of Object.entries(err.fieldErrors)) {
            if (field === "name" || field === "role" || field === "is_active") {
              const formField = field === "is_active" ? "isActive" : (field as "name" | "role");
              form.setError(formField, { type: "server", message });
            } else {
              setFormError(message);
            }
          }
          return;
        }
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
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update name, role, and active status.</DialogDescription>
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {ROLE_VALUES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <input
                      id={`${field.name}-checkbox`}
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <FormLabel htmlFor={`${field.name}-checkbox`} className="mb-0">
                      Active
                    </FormLabel>
                  </div>
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
