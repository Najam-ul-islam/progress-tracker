import { Badge } from "@/components/ui/badge";

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "active" : "inactive"}>
      {isActive ? "Active" : "Inactive"}
    </Badge>
  );
}
