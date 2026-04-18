import { Calendar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DataSet } from "@/lib/types";
import { defaultFilters, uniques, type Filters } from "@/lib/analytics";

interface Props {
  data: DataSet;
  filters: Filters;
  onChange: (f: Filters) => void;
}

const ALL = "__all__";

export function FilterBar({ data, filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const sel = (v: string) => (v === ALL ? undefined : v);

  const areas = uniques(data.collections, "area");
  const suburbs = uniques(
    filters.area ? data.collections.filter((c) => c.area === filters.area) : data.collections,
    "suburb",
  );
  const itemCategories = uniques(data.collections, "item_category");
  const itemTypes = uniques(data.collections, "item_type");
  const sourceTypes = uniques(data.collections, "source_type");
  const materials = Array.from(
    new Set([...data.extractions.map((e) => e.material_type), ...data.sales.map((s) => s.material_type)]),
  ).sort();
  const buyers = uniques(data.sales, "buyer");
  const grades = Array.from(
    new Set([...data.extractions.map((e) => e.grade), ...data.sales.map((s) => s.grade)]),
  ).sort();

  return (
    <div className="surface p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="size-4 text-primary" />
          Filters & Slicers
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(defaultFilters(data))}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" /> Reset
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Field label="From">
          <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="h-9" />
        </Field>
        <Field label="To">
          <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className="h-9" />
        </Field>
        <Field label="Granularity">
          <Select value={filters.granularity} onValueChange={(v) => set({ granularity: v as Filters["granularity"] })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Area">
          <Select value={filters.area ?? ALL} onValueChange={(v) => set({ area: sel(v), suburb: undefined })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All areas</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Suburb">
          <Select value={filters.suburb ?? ALL} onValueChange={(v) => set({ suburb: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All suburbs</SelectItem>
              {suburbs.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Item category">
          <Select value={filters.item_category ?? ALL} onValueChange={(v) => set({ item_category: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {itemCategories.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Item type">
          <Select value={filters.item_type ?? ALL} onValueChange={(v) => set({ item_type: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {itemTypes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Material">
          <Select value={filters.material_type ?? ALL} onValueChange={(v) => set({ material_type: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {materials.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Buyer">
          <Select value={filters.buyer ?? ALL} onValueChange={(v) => set({ buyer: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {buyers.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Source type">
          <Select value={filters.source_type ?? ALL} onValueChange={(v) => set({ source_type: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {sourceTypes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Grade">
          <Select value={filters.grade ?? ALL} onValueChange={(v) => set({ grade: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {grades.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Payment">
          <Select value={filters.payment_status ?? ALL} onValueChange={(v) => set({ payment_status: sel(v) })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
