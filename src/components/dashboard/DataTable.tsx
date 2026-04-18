import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/dataImport";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  align?: "left" | "right" | "center";
  format?: (value: unknown, row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;
  className?: string;
  // Conditional formatting bar (0..1) for numeric cols
  bar?: (row: T) => number | undefined;
}

interface Props<T> {
  title?: string;
  columns: Column<T>[];
  rows: T[];
  pageSize?: number;
  searchable?: boolean;
  exportName?: string;
  emptyText?: string;
}

export function DataTable<T extends object>({
  title,
  columns,
  rows,
  pageSize = 10,
  searchable = true,
  exportName,
  emptyText = "No rows.",
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      Object.values(r as Record<string, unknown>).some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => String(c.key) === sortKey);
    if (!col) return filtered;
    const valOf = (r: T) => {
      if (col.sortValue) return col.sortValue(r);
      const v = (r as Record<string, unknown>)[String(col.key)];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : String(v ?? "").toLowerCase();
    };
    return [...filtered].sort((a, b) => {
      const av = valOf(a);
      const bv = valOf(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const onSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="surface flex flex-col">
      {(title || searchable || exportName) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-3">
          {title && <h3 className="font-display text-sm font-semibold tracking-tight mr-auto">{title}</h3>}
          {searchable && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(0); }}
                className="h-8 w-44 pl-8 text-xs"
              />
            </div>
          )}
          {exportName && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => downloadCsv(exportName, sorted as unknown as Record<string, unknown>[])}
            >
              <Download className="size-3.5" /> Export CSV
            </Button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  onClick={() => onSort(String(c.key))}
                  className={cn(
                    "select-none cursor-pointer px-3 py-2 font-medium",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  <span className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                    {c.label}
                    {sortKey === String(c.key) ? (
                      sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                    ) : (
                      <ArrowUpDown className="size-3 opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
            {slice.map((row, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                {columns.map((c) => {
                  const v = (row as Record<string, unknown>)[String(c.key)];
                  const barPct = c.bar?.(row);
                  return (
                    <td
                      key={String(c.key)}
                      className={cn(
                        "relative px-3 py-2 text-foreground/90",
                        c.align === "right" && "text-right tabular-nums",
                        c.align === "center" && "text-center",
                        c.className,
                      )}
                    >
                      {barPct != null && (
                        <div
                          aria-hidden
                          className="absolute inset-y-1 left-0 rounded-r-sm bg-primary/15"
                          style={{ width: `${Math.min(100, Math.max(0, barPct * 100))}%` }}
                        />
                      )}
                      <span className="relative">{c.format ? c.format(v, row) : (v as React.ReactNode)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t border-border/50">
          <span>
            {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="h-7">
              Prev
            </Button>
            <Button variant="ghost" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="h-7">
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
