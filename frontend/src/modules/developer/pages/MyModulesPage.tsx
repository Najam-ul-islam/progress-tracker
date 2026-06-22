import { AssignedModulesTable } from "@/modules/developer/components/AssignedModulesTable";

export function MyModulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Modules</h1>
        <p className="text-sm text-slate-500">View and update your assigned modules.</p>
      </div>
      <AssignedModulesTable />
    </div>
  );
}