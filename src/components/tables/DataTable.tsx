import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  pageSize?: number;
  initialSort?: { key: string; dir: "asc" | "desc" };
  caption: string;
}

export function DataTable<T>({ rows, columns, getRowId, pageSize = 10, initialSort, caption }: Props<T>) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);

  useEffect(() => setPage(0), [rows]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b text-left">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground", c.align === "right" && "text-right")}
                  >
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground")}>
                        {c.header}
                        <Icon className="h-3 w-3" aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={getRowId(row)} className="border-b last:border-0 hover:bg-muted/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn("whitespace-nowrap px-3 py-2", c.align === "right" && "num text-right")}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {sorted.length === 0 ? 0 : current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length.toLocaleString("en-IN")} rows
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            Page {current + 1} of {pages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
