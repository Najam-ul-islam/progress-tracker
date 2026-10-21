import { z } from "zod";
import { ROLES } from "@/modules/auth/types";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "At least one letter")
    .regex(/\d/, "At least one digit"),
  role: z.enum(ROLES, { message: "Pick a role" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
