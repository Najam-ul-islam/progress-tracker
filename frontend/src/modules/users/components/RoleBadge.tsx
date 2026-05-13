import { Badge } from "@/components/ui/badge";
import type { Role } from "@/modules/auth/types";

const LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  developer: "Developer",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role} aria-label={`Role: ${LABELS[role]}`}>
      {LABELS[role]}
    </Badge>
  );
}
