import { AssignedProjectsTable } from "@/modules/developer/components/AssignedProjectsTable";

export function MyProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Projects</h1>
        <p className="text-sm text-slate-500">View your assigned projects.</p>
      </div>
      <AssignedProjectsTable />
    </div>
  );
}