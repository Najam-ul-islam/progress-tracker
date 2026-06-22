import { useNavigate } from "react-router-dom";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "./StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { Project, ProjectStatus } from "@/modules/projects/types";

interface ProjectKanbanProps {
  projects: Project[];
}

interface KanbanColumnProps {
  title: string;
  status: ProjectStatus;
  projects: Project[];
  onProjectClick: (id: number) => void;
}

function KanbanColumn({ title, projects, onProjectClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-lg min-h-[500px] border border-slate-100">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
          {projects.length}
        </span>
      </div>
      
      <div className="flex flex-col gap-3">
        {projects.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col gap-3 bg-white p-4 rounded-md border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
            onClick={() => onProjectClick(p.id)}
          >
            <div className="flex flex-col gap-1">
              <h4 className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                {p.name}
              </h4>
              <p className="text-xs text-slate-500 line-clamp-2">
                {p.description || "No description provided."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                <span>Progress</span>
                <span>0%</span>
              </div>
              <ProgressBar value={0} />
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-mono text-slate-600">
                {formatCurrency(p.totalAmount)}
              </span>
              <StatusBadge status={p.status} className="scale-90" />
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200 rounded-md text-slate-400 text-sm">
            No projects
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectKanban({ projects }: ProjectKanbanProps) {
  const navigate = useNavigate();

  const pending = projects.filter((p) => p.status === "pending");
  const active = projects.filter((p) => p.status === "active");
  const completed = projects.filter((p) => p.status === "completed");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <KanbanColumn
        title="Pending"
        status="pending"
        projects={pending}
        onProjectClick={(id) => navigate(`/projects/${id}`)}
      />
      <KanbanColumn
        title="Active"
        status="active"
        projects={active}
        onProjectClick={(id) => navigate(`/projects/${id}`)}
      />
      <KanbanColumn
        title="Completed"
        status="completed"
        projects={completed}
        onProjectClick={(id) => navigate(`/projects/${id}`)}
      />
    </div>
  );
}