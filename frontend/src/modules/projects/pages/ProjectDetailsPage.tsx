import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/modules/auth/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Play } from "lucide-react";
import { projectsApi, PROJECTS_QUERY_KEYS } from "@/modules/projects/services/projects.api";
import { StatusBadge } from "@/modules/projects/components/StatusBadge";
import { ProgressBar } from "@/modules/projects/components/ProgressBar";
import { CreateModuleDialog } from "@/modules/projects/components/CreateModuleDialog";
import { UpdateProgressDialog } from "@/modules/projects/components/UpdateProgressDialog";
import { GeneratePaymentDialog } from "@/modules/payments/components/GeneratePaymentDialog";
import { useSessionStore, selectRole, selectUserId } from "@/modules/auth/store/session.store";
import { canEditProjects, canUpdateProgress } from "@/lib/rbac";
import { ProjectsApiError } from "@/modules/projects/types";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { companyReserve, developerPool, advanceBounds } from "@/lib/payments";

export function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const role = useSessionStore(selectRole);
  const sessionUserId = useSessionStore(selectUserId) as number | null;
  const canManage = canEditProjects(role);

  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [isGeneratePaymentOpen, setIsGeneratePaymentOpen] = useState(false);
  const [updatingModule, setUpdatingModule] = useState<{ id: number; name: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Activation is a pure status transition. The advance-payment gate is checked
  // by the backend; if it isn't met we surface a message pointing the user to the
  // separate "Collect Advance" action — we never open the payment dialog from here.
  const activateMutation = useMutation({
    mutationFn: () => projectsApi.update(projectId, { status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEYS.progress(projectId) });
      setError(null);
    },
    onError: (err) => {
      if (err instanceof ProjectsApiError) {
        setError(
          err.message.includes("advance payment required")
            ? "Activation blocked: collect at least a 30% advance payment first (use “Collect Advance” below)."
            : err.message
        );
      } else setError("Failed to activate project");
    },
  });

  const { data: project, isLoading: isLoadingProject, error: projectError } = useQuery({
    queryKey: PROJECTS_QUERY_KEYS.detail(projectId),
    queryFn: () => projectsApi.get(projectId),
    enabled: !isNaN(projectId),
  });

  const { data: progress, isLoading: isLoadingProgress } = useQuery({
    queryKey: PROJECTS_QUERY_KEYS.progress(projectId),
    queryFn: () => projectsApi.getProgress(projectId),
    enabled: !isNaN(projectId),
  });

  const totalShareAllocated = progress?.modules.reduce((sum, m) => sum + m.sharePercentage, 0) || 0;
  // We don't have paid amount here yet, but the backend will enforce it.
  // For better UX, I could fetch the paid amount, but for now I'll just let the backend error show if it fails.
  const canActivate = project?.status === "pending" && totalShareAllocated >= 69.9;

  if (isLoadingProject) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader />
        <main className="container mx-auto px-4 py-8 animate-pulse">
          <div className="h-8 w-64 bg-slate-100 rounded mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 h-96 bg-slate-50 rounded-lg" />
            <div className="h-64 bg-slate-50 rounded-lg" />
          </div>
        </main>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="min-h-screen bg-white">
        <AppHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-lg border border-slate-100 text-slate-600">
            <h2 className="text-xl font-semibold">Project not found</h2>
            <Link to="/projects" className="mt-4 text-indigo-600 hover:underline">
              Back to projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <Link
            to="/projects"
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors w-fit"
          >
            <ArrowLeft size={16} />
            Back to Projects
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-sm text-slate-500 max-w-2xl">
                {project.description || "No description provided."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {project.status === "pending" && canManage && (
<Button
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-2",
                    canActivate
                      ? "text-indigo-600 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                      : "text-slate-400 border-slate-200"
                  )}
                  disabled={!canActivate || activateMutation.isPending}
                  onClick={() => activateMutation.mutate()}
                  title={`Current shares: ${totalShareAllocated.toFixed(2)}%${totalShareAllocated < 69.99 ? `. Need ${(70 - totalShareAllocated).toFixed(2)}% more to activate` : ""}`}
                >
                  <Play size={16} fill="currentColor" />
                  {activateMutation.isPending ? "Activating..." : "Activate Project"}
                </Button>
              )}
              {canManage && project.status !== "completed" && (
                <Button className="flex items-center gap-2" onClick={() => setIsAddModuleOpen(true)}>
                  <Plus size={16} />
                  Add Module
                </Button>
              )}
            </div>
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        </div>

        <CreateModuleDialog
          projectId={projectId}
          open={isAddModuleOpen}
          onOpenChange={setIsAddModuleOpen}
          currentShareTotal={totalShareAllocated}
        />

        {updatingModule && (
          <UpdateProgressDialog
            projectId={projectId}
            moduleId={updatingModule.id}
            moduleName={updatingModule.name}
            currentProgress={updatingModule.progress}
            open={!!updatingModule}
            onOpenChange={(open) => !open && setUpdatingModule(null)}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 flex flex-col gap-6">
            <section className="flex flex-col gap-4 bg-white p-6 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Project Modules</h2>
                {project.status === "pending" && (
                  <span className="text-sm text-slate-500">
                    Shares: {totalShareAllocated.toFixed(2)}% / 70%
                  </span>
                )}
              </div>
              {isLoadingProgress ? (
                <div className="h-48 bg-slate-50 animate-pulse rounded-md" />
              ) : progress && progress.modules.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {progress.modules.map(m => {
                    // Admin/manager always; a developer only on the module they're
                    // assigned to (assignee carried in the progress summary).
                    const canUpdate = canUpdateProgress(role, sessionUserId, m.assignedDeveloperId);

                    return (
                      <div key={m.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="text-sm font-medium text-slate-900">{m.name}</span>
                          <div className="flex items-center gap-3">
                            <ProgressBar value={m.progress} className="w-32" />
                            <span className="text-xs text-slate-500 font-medium">{m.progress}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-slate-500 font-mono">{m.sharePercentage}% share</span>
                          {canUpdate && project.status === "active" && (
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => setUpdatingModule({ id: m.id, name: m.name, progress: m.progress })}
                            >
                              Update
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500">
                  <p className="text-sm">No modules assigned yet.</p>
                  {canManage && (
                    <Button variant="link" className="mt-2 text-indigo-600">
                      Add the first module
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="bg-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col gap-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Overall Progress</h3>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight">
                  {Math.round(progress?.progress || 0)}%
                </span>
                <span className="text-slate-400 text-sm mb-1.5 font-medium">Complete</span>
              </div>
              <ProgressBar value={progress?.progress || 0} className="bg-slate-800" />
            </section>

            <section className="flex flex-col gap-4 bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Project Timeline</h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Start Date</span>
                  <span className="text-sm text-slate-700 font-medium">{project.startDate}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Estimated End</span>
                  <span className="text-sm text-slate-700 font-medium">{project.endDate}</span>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4 bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Financial Setup</h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Total Project Amount</span>
                  <span className="text-sm text-slate-700 font-mono font-bold">
                    {formatCurrency(Number(project.totalAmount))}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Company Reserve (30%)</span>
                    <span className="text-sm text-slate-700 font-semibold">
                      {formatCurrency(companyReserve(Number(project.totalAmount)))}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Developer Pool (70%)</span>
                    <span className="text-sm text-slate-700 font-semibold">
                      {formatCurrency(developerPool(Number(project.totalAmount)))}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setIsGeneratePaymentOpen(true)}
                  >
                    {project.status === "pending" ? "Collect Advance" : "Generate Payment"}
                  </Button>
                )}
                {project.status === "pending" && (
                  <p className="text-[10px] text-slate-500 mt-1 italic text-center">
                    Collect a 30%–50% advance ({formatCurrency(advanceBounds(Number(project.totalAmount)).min)}–{formatCurrency(advanceBounds(Number(project.totalAmount)).max)}) here. Activation is a separate step, unlocked once ≥30% is paid.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>

        <GeneratePaymentDialog
          projectId={projectId}
          projectTotalAmount={project.totalAmount}
          projectStatus={project.status}
          open={isGeneratePaymentOpen}
          onOpenChange={setIsGeneratePaymentOpen}
        />
      </main>
    </div>
  );
}
