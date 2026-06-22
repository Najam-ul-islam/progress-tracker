import { z } from "zod";

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().optional(),
  clientId: z.string().min(1, "Client is required"), // Numeric ID as string from Select
  assignedDeveloperId: z.string().optional(), // Optional, as project may be created before assignment
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format (e.g. 1000.00)"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
}).refine(data => {
  if (!data.startDate || !data.endDate) return true;
  return new Date(data.endDate) >= new Date(data.startDate);
}, {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const emptyProjectFormValues: ProjectFormValues = {
  name: "",
  description: "",
  clientId: "",
  assignedDeveloperId: "",
  totalAmount: "",
  startDate: "",
  endDate: "",
};
