import { z } from "zod";

export const moduleFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().optional(),
  assignedDeveloperId: z.string().min(1, "Developer is required"), // Numeric ID as string
  sharePercentage: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid percentage format (e.g. 25.50)"),
});

export type ModuleFormValues = z.infer<typeof moduleFormSchema>;

export const emptyModuleFormValues: ModuleFormValues = {
  name: "",
  description: "",
  assignedDeveloperId: "",
  sharePercentage: "",
};
