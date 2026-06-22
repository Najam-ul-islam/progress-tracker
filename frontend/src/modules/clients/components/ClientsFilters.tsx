import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterToParams, parseFilter } from "@/modules/clients/schemas/clients-filter.schema";

export function ClientsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseFilter(searchParams);

  function setQuery(q: string) {
    setSearchParams(filterToParams({ ...filter, q }), { replace: true });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="clients-search">Search</Label>
        <Input
          id="clients-search"
          type="search"
          placeholder="Search by name, company, email, or phone"
          value={filter.q}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
    </div>
  );
}
