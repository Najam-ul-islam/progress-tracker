import { z } from "zod";
import type { EditDraft, Role, User } from "@/modules/users/types";

export const ROLE_VALUES = ["admin", "manager", "developer"] as const satisfies readonly Role[];

export const editUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name must be 120 characters or fewer"),
  role: z.enum(ROLE_VALUES, { message: "Select a role" }),
  isActive: z.boolean(),
});

export type EditUserFormValues = z.infer<typeof editUserSchema>;

export function userToFormValues(user: User): EditUserFormValues {
  return {
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

export function diffDraft(original: User, values: EditUserFormValues): EditDraft {
  const draft: EditDraft = {};
  if (values.name.trim() !== original.name) draft.name = values.name.trim();
  if (values.role !== original.role) draft.role = values.role;
  if (values.isActive !== original.isActive) draft.isActive = values.isActive;
  return draft;
}

export function hasChanges(draft: EditDraft): boolean {
  return draft.name !== undefined || draft.role !== undefined || draft.isActive !== undefined;
}
