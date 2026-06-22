import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";
import { canEditClients, canDeleteClients } from "@/lib/rbac";
import type { Client } from "@/modules/clients/types";

type ClientsTableProps = {
  clients: Client[];
  onEdit?: (client: Client) => void;
  onDelete?: (client: Client) => void;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function ClientsTable({ clients, onEdit, onDelete }: ClientsTableProps) {
  const navigate = useNavigate();
  const role = useSessionStore(selectRole);
  const showEdit = canEditClients(role);
  const showDelete = canDeleteClients(role);
  const showActions = showEdit || showDelete;

  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Name</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Created</TableHead>
          {showActions ? <TableHead className="text-right">Actions</TableHead> : null}
        </tr>
      </TableHeader>
      <TableBody>
        {clients.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer"
            onClick={() => navigate(`/clients/${c.id}`)}
          >
            <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
            <TableCell>{c.companyName ?? "—"}</TableCell>
            <TableCell>{c.email}</TableCell>
            <TableCell>{c.phone}</TableCell>
            <TableCell>{formatDate(c.createdAt)}</TableCell>
            {showActions ? (
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {showEdit ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(c);
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {showDelete ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(c);
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
