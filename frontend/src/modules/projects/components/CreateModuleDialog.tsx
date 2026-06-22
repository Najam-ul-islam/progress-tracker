import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { projectsApi, PROJECTS_QUERY_KEYS } from "@/modules/projects/services/projects.api";
import { usersApi } from "@/modules/users/services/users.api";
import { moduleFormSchema, type ModuleFormValues, emptyModuleFormValues } from "@/modules/projects/schemas/module-form.schema";
import { ProjectsApiError } from "@/modules/projects/types";
import { type ModuleCreateBodyWire } from "@/modules/projects/services/projects.api";

interface CreateModuleDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentShareTotal?: number;
}

export function CreateModuleDialog({ projectId, open, onOpenChange, currentShareTotal = 0 }: CreateModuleDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["users", "list"],
    queryFn: usersApi.list,
    enabled: open,
  });

  const developers = users.filter(u => u.role === "developer");

  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: emptyModuleFormValues,
  });

  const mutation = useMutation({
    mutationFn: (body: ModuleCreateBodyWire) => projectsApi.addModule(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.progress(projectId) });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => {
      if (err instanceof ProjectsApiError) {
        setFormError(err.message);
      } else {
        setFormError("Something went wrong");
      }
    },
  });

async function onSubmit(values: ModuleFormValues) {
    setFormError(null);
    await mutation.mutateAsync({
      name: values.name,
      description: values.description || undefined,
      assigned_developer_id: Number(values.assignedDeveloperId),
      share_percentage: Number(values.sharePercentage),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Module</DialogTitle>
          <DialogDescription>
            Assign a new module to a developer. Module shares must sum to exactly 70%.
          </DialogDescription>
          <p className="text-sm text-slate-500 mt-2">
            Current allocation: <strong>{currentShareTotal}%</strong> — {(70 - currentShareTotal).toFixed(2)}% remaining
            to enable project activation.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Module Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. API Foundation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedDeveloperId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Developer</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">Select a developer</option>
                      {developers.map(d => (
                        <option key={d.id} value={String(d.id)}>
                          {d.name}
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
              name="sharePercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Share Percentage (%)</FormLabel>
                  <FormControl>
                    <Input placeholder="25.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {formError && (
              <p className="text-sm font-medium text-red-600">{formError}</p>
            )}

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
                {mutation.isPending ? "Adding..." : "Add Module"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
