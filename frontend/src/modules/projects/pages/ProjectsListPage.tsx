import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/modules/auth/components/AppHeader";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table as TableIcon, Plus } from "lucide-react";
import { projectsApi, PROJECTS_QUERY_KEYS } from "@/modules/projects/services/projects.api";
import { ProjectTable } from "@/modules/projects/components/ProjectTable";
import { ProjectKanban } from "@/modules/projects/components/ProjectKanban";
import { CreateProjectDialog } from "@/modules/projects/components/CreateProjectDialog";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";
import { canEditProjects } from "@/lib/rbac";
import { cn } from "@/lib/cn";

export function ProjectsListPage() {
  const [view, setView] = useState<"table" | "kanban">("table");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const role = useSessionStore(selectRole);
  const canCreate = canEditProjects(role);

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: PROJECTS_QUERY_KEYS.list(),
    queryFn: projectsApi.list,
  });

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20 bg-red-50 rounded-lg border border-red-100 text-red-600">
            <h2 className="text-xl font-semibold">Failed to load projects</h2>
            <p className="text-sm opacity-80">Please check your connection and try again.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
            <p className="text-sm text-slate-500">Manage and track project delivery across your team.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setView("table")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  view === "table" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
                aria-label="Table view"
              >
                <TableIcon size={18} />
              </button>
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  view === "kanban" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
                aria-label="Kanban view"
              >
                <LayoutGrid size={18} />
              </button>
            </div>

            {canCreate && (
              <Button className="flex items-center gap-2" onClick={() => setIsCreateOpen(true)}>
                <Plus size={18} />
                <span>New Project</span>
              </Button>
            )}
          </div>
        </div>

        <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {view === "table" ? (
              <ProjectTable projects={projects} />
            ) : (
              <ProjectKanban projects={projects} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
