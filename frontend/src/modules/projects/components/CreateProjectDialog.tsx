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
import { clientsApi } from "@/modules/clients/services/clients.api";
import { usersApi } from "@/modules/users/services/users.api";
import { projectFormSchema, type ProjectFormValues, emptyProjectFormValues } from "@/modules/projects/schemas/project-form.schema";
import { ProjectsApiError } from "@/modules/projects/types";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "list"],
    queryFn: clientsApi.list,
    enabled: open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users", "list"],
    queryFn: usersApi.list,
    enabled: open,
  });

  const developers = users.filter(u => u.role === "developer");

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: emptyProjectFormValues,
  });

  const mutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.list() });
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

  async function onSubmit(values: ProjectFormValues) {
    setFormError(null);
    await mutation.mutateAsync({
      name: values.name,
      description: values.description,
      client_id: Number(values.clientId),
      assigned_developer_id: values.assignedDeveloperId ? Number(values.assignedDeveloperId) : undefined,
      total_amount: values.totalAmount,
      start_date: values.startDate,
      end_date: values.endDate,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Onboard a new project. You can add modules and activate it later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Phoenix Migration" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">Select a client</option>
                      {clients.map(c => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} {c.companyName ? `(${c.companyName})` : ""}
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
              name="assignedDeveloperId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign Developer (Optional)</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Budget</FormLabel>
                  <FormControl>
                    <Input placeholder="10000.00" {...field} />
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
                {mutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
