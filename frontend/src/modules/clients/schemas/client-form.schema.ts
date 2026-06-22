import { z } from "zod";
import type { Client, ClientDraft } from "@/modules/clients/types";

// Phone format copied verbatim from 004-clients-management/contracts/openapi.yaml
// to avoid a pass-here / fail-at-the-API mismatch.
export const PHONE_PATTERN = /^\+\d{1,3}[\d\s\-()]{6,18}\d$/;

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name must be 120 characters or fewer"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(320, "Email must be 320 characters or fewer"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(PHONE_PATTERN, "Phone must be international format, e.g. +1 415 555 0101"),
  companyName: z.string().trim().max(200, "Company name must be 200 characters or fewer"),
  address: z.string().trim().max(500, "Address must be 500 characters or fewer"),
  notes: z.string(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const emptyFormValues: ClientFormValues = {
  name: "",
  email: "",
  phone: "",
  companyName: "",
  address: "",
  notes: "",
};

export function clientToFormValues(client: Client): ClientFormValues {
  return {
    name: client.name,
    email: client.email,
    phone: client.phone,
    companyName: client.companyName ?? "",
    address: client.address ?? "",
    notes: client.notes ?? "",
  };
}

// For edit: only the fields that changed vs the original.
// An emptied optional becomes null (so the backend clears it); an emptied
// required field cannot reach here (Zod blocks it first).
export function diffDraft(original: Client, values: ClientFormValues): ClientDraft {
  const draft: ClientDraft = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const phone = values.phone.trim();
  const companyName = values.companyName.trim();
  const address = values.address.trim();
  const notes = values.notes;

  if (name !== original.name) draft.name = name;
  if (email !== original.email) draft.email = email;
  if (phone !== original.phone) draft.phone = phone;
  if (companyName !== (original.companyName ?? "")) draft.companyName = companyName || null;
  if (address !== (original.address ?? "")) draft.address = address || null;
  if (notes !== (original.notes ?? "")) draft.notes = notes || null;

  return draft;
}

export function hasChanges(draft: ClientDraft): boolean {
  return Object.keys(draft).length > 0;
}
