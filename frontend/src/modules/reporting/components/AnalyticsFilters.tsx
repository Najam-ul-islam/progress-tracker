import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAnalyticsFilter } from "@/modules/reporting/hooks/useAnalyticsFilter";
import { useClientsList } from "@/modules/clients/hooks/useClientsList";
import { useUsersList } from "@/modules/users/hooks/useUsersList";
import type { ProjectStatus } from "@/modules/reporting/types";

interface AnalyticsFiltersProps {
  /** Project + Developer views support developer_id; the Revenue view does not. */
  showDeveloperFilter?: boolean;
}

export function AnalyticsFilters({ showDeveloperFilter = true }: AnalyticsFiltersProps) {
  const { filter, setFilter, clearFilters, dateError } = useAnalyticsFilter();
  const clientsQuery = useClientsList();
  const usersQuery = useUsersList();

  const developers = (usersQuery.data ?? []).filter((u) => u.role === "developer");

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="date_from">Date from</Label>
          <Input
            id="date_from"
            type="date"
            value={filter.date_from ?? ""}
            onChange={(e) => setFilter({ ...filter, date_from: e.target.value || undefined })}
            aria-invalid={dateError || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date_to">Date to</Label>
          <Input
            id="date_to"
            type="date"
            value={filter.date_to ?? ""}
            onChange={(e) => setFilter({ ...filter, date_to: e.target.value || undefined })}
            aria-invalid={dateError || undefined}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="project_status">Status</Label>
          <Select
            id="project_status"
            value={filter.project_status ?? ""}
            onChange={(e) =>
              setFilter({
                ...filter,
                project_status: (e.target.value || undefined) as ProjectStatus | undefined,
              })
            }
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client_id">Client</Label>
          <Select
            id="client_id"
            value={filter.client_id?.toString() ?? ""}
            onChange={(e) =>
              setFilter({ ...filter, client_id: e.target.value ? Number(e.target.value) : undefined })
            }
          >
            <option value="">All clients</option>
            {clientsQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {showDeveloperFilter && (
          <div className="space-y-1.5">
            <Label htmlFor="developer_id">Developer</Label>
            <Select
              id="developer_id"
              value={filter.developer_id?.toString() ?? ""}
              onChange={(e) =>
                setFilter({
                  ...filter,
                  developer_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            >
              <option value="">All developers</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs" role={dateError ? "alert" : undefined}>
          {dateError && (
            <span className="font-medium text-red-600">Date from must be on or before date to.</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
          Clear filters
        </Button>
      </div>
    </div>
  );
}
