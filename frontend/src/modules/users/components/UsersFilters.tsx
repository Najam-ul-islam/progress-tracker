import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  filterToParams,
  parseFilter,
  ROLE_FILTER_VALUES,
  STATUS_FILTER_VALUES,
} from "@/modules/users/schemas/users-filter.schema";

export function UsersFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams);

  function setFilter(patch: Partial<typeof filter>) {
    const next = { ...filter, ...patch };
    setSearchParams(filterToParams(next), { replace: true });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="users-search">Search</Label>
        <Input
          id="users-search"
          type="search"
          placeholder="Search by name or email"
          value={filter.q}
          onChange={(e) => setFilter({ q: e.target.value })}
        />
      </div>
      <div className="w-full sm:w-48">
        <Label htmlFor="users-role">Role</Label>
        <Select
          id="users-role"
          value={filter.role}
          onChange={(e) => setFilter({ role: e.target.value as typeof filter.role })}
        >
          {ROLE_FILTER_VALUES.map((v) => (
            <option key={v} value={v}>
              {v === "any" ? "Any role" : v[0].toUpperCase() + v.slice(1)}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-full sm:w-48">
        <Label htmlFor="users-status">Status</Label>
        <Select
          id="users-status"
          value={filter.status}
          onChange={(e) => setFilter({ status: e.target.value as typeof filter.status })}
        >
          {STATUS_FILTER_VALUES.map((v) => (
            <option key={v} value={v}>
              {v === "all" ? "All statuses" : v[0].toUpperCase() + v.slice(1)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
