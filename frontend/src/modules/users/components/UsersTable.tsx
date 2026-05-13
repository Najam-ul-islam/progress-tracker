import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleBadge } from "@/modules/users/components/RoleBadge";
import { StatusBadge } from "@/modules/users/components/StatusBadge";
import { IfAdmin } from "@/modules/users/components/IfRole";
import { Button } from "@/components/ui/button";
import type { User } from "@/modules/users/types";

type UsersTableProps = {
  users: User[];
  onEdit?: (user: User) => void;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function UsersTable({ users, onEdit }: UsersTableProps) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <IfAdmin>
            <TableHead className="text-right">Actions</TableHead>
          </IfAdmin>
        </tr>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow
            key={u.id}
            data-state={u.isActive ? "active" : "inactive"}
            className="cursor-pointer"
            onClick={() => navigate(`/users/${u.id}`)}
          >
            <TableCell className="font-medium text-slate-900">{u.name}</TableCell>
            <TableCell>{u.email}</TableCell>
            <TableCell>
              <RoleBadge role={u.role} />
            </TableCell>
            <TableCell>
              <StatusBadge isActive={u.isActive} />
            </TableCell>
            <TableCell>{formatDate(u.createdAt)}</TableCell>
            <IfAdmin>
              <TableCell className="text-right">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(u);
                  }}
                >
                  Edit
                </Button>
              </TableCell>
            </IfAdmin>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
