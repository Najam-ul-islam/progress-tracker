import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

type WithId = { id?: string | number; [key: string]: unknown };

interface DataTableProps<T extends WithId> {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  searchPlaceholder?: string;
  searchKey?: keyof T;
}

export function DataTable<T extends WithId>({
  data,
  columns,
  pageSize = 5,
  searchPlaceholder = "Search...",
  searchKey,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Handle client-side search filtering
  const filteredData = useMemo(() => {
    if (!searchQuery || !searchKey) return data;
    return data.filter((item) => {
      const val = item[searchKey];
      if (val === undefined || val === null) return false;
      return String(val).toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [data, searchQuery, searchKey]);

  // Compute pagination details
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));

  // Reset page index if query reduces total pages below current page index
  const adjustedCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const startIndex = (adjustedCurrentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, adjustedCurrentPage, pageSize]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
      {/* Search Header (optional, only renders if searchKey is passed) */}
      {searchKey && (
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-650" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
               className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:border-[var(--accent)] dark:focus:border-[var(--accent)] transition-colors"
            />
          </div>
        </div>
      )}

      {/* Table grid */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550 select-none"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, rowIdx) => {
                const key = item.id !== undefined ? String(item.id) : String(rowIdx);
                return (
                  <tr
                    key={key}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-3.5 text-xs text-slate-650 dark:text-slate-350">
                        {col.render ? col.render(item) : String(item[col.key])}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-slate-400 dark:text-slate-500"
                >
                  No matching records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20">
        <span className="text-xs text-slate-500 dark:text-slate-450">
          Showing <span className="font-semibold text-slate-900 dark:text-white">
            {filteredData.length > 0 ? (adjustedCurrentPage - 1) * pageSize + 1 : 0}
          </span> to <span className="font-semibold text-slate-900 dark:text-white">
            {Math.min(adjustedCurrentPage * pageSize, filteredData.length)}
          </span> of <span className="font-semibold text-slate-900 dark:text-white">{filteredData.length}</span> results
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={adjustedCurrentPage === 1}
            className="flex items-center justify-center p-1.5 rounded-lg border border-slate-250 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-700 dark:text-slate-300 transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-450">
            Page {adjustedCurrentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={adjustedCurrentPage === totalPages}
            className="flex items-center justify-center p-1.5 rounded-lg border border-slate-250 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-700 dark:text-slate-300 transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}