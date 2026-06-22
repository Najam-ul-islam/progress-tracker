import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { Project } from "@/modules/projects/types";

interface ProjectTableProps {
  projects: Project[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export function ProjectTable({ projects }: ProjectTableProps) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <tr>
          <TableHead>Project Name</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Budget</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Status</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {projects.map((p) => (
          <TableRow
            key={p.id}
            className="cursor-pointer"
            onClick={() => navigate(`/projects/${p.id}`)}
          >
            <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
            <TableCell className="text-slate-500 whitespace-nowrap">
              {p.startDate && p.endDate ? `${formatDate(p.startDate)} to ${formatDate(p.endDate)}` : "—"}
            </TableCell>
            <TableCell className="text-slate-700 font-mono">
              {formatCurrency(p.totalAmount)}
            </TableCell>
            <TableCell className="min-w-[120px]">
              <div className="flex items-center gap-2">
                <ProgressBar value={0} className="w-24" />
                <span className="text-xs text-slate-500">0%</span>
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge status={p.status} />
            </TableCell>
          </TableRow>
        ))}
        {projects.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="h-24 text-center text-slate-500">
              No projects found.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
