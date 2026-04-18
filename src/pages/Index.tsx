import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Funnel, FunnelChart, LabelList,
  Legend, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, Treemap, XAxis, YAxis,
} from "recharts";
import {
  Activity, BarChart3, Boxes, Coins, Factory, Flame, Gauge, MapPin, Package, ShoppingCart,
  Sparkles, Truck, Wallet,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { DarkTooltip, kgFmt, moneyFmt } from "@/components/dashboard/DarkTooltip";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { InsightPanel } from "@/components/dashboard/InsightPanel";
import { generateDemoData } from "@/lib/demoData";
import {
  applyFilters, computeKpis, defaultFilters, expectedVsActualYield, generateInsights,
  groupSum, KG, NUM, PCT, pctChange, priorPeriod, profitabilityByItem, recoveryFunnel,
  timeSeries, ZAR, type Filters,
} from "@/lib/analytics";
import type { Collection, DataSet, Extraction, InventoryRow, Sale } from "@/lib/types";
import { MATERIAL_COLORS } from "@/lib/types";

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-6))", "hsl(var(--chart-7))",
];
const axisProps = {
  stroke: "hsl(var(--muted-foreground))",
  tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "hsl(var(--border))" },
};

const Index = () => {
  const [data, setData] = useState<DataSet>(() => generateDemoData());
  const [source, setSource] = useState<"demo" | "upload">("demo");
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(data));

  const filtered = useMemo(() => applyFilters(data, filters), [data, filters]);
  const prevFiltered = useMemo(() => applyFilters(data, priorPeriod(filters)), [data, filters]);

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const prevKpis = useMemo(() => computeKpis(prevFiltered), [prevFiltered]);

  // Trend sparklines (always weekly for KPI sparks)
  const collectionsTS = useMemo(
    () => timeSeries(filtered.collections, "collection_date", "quantity_collected", filters.granularity),
    [filtered.collections, filters.granularity],
  );
  const copperTS = useMemo(
    () =>
      timeSeries(
        filtered.extractions.filter((e) => e.material_type === "Copper"),
        "extraction_date",
        "quantity_extracted_kg",
        filters.granularity,
      ),
    [filtered.extractions, filters.granularity],
  );
  const salesKgTS = useMemo(
    () => timeSeries(filtered.sales, "sale_date", "quantity_sold_kg", filters.granularity),
    [filtered.sales, filters.granularity],
  );
  const revenueTS = useMemo(
    () => timeSeries(filtered.sales, "sale_date", "total_received", filters.granularity),
    [filtered.sales, filters.granularity],
  );

  // Stacked sales by material over time
  const salesByMaterialTS = useMemo(() => {
    const buckets = new Map<string, Record<string, number>>();
    const mats = new Set<string>();
    for (const s of filtered.sales) {
      const k = timeSeries([s], "sale_date", "total_received", filters.granularity)[0].period;
      mats.add(s.material_type);
      const row = buckets.get(k) ?? { period: k };
      row[s.material_type] = ((row[s.material_type] as number) ?? 0) + s.total_received;
      buckets.set(k, row);
    }
    return {
      data: Array.from(buckets.values()).sort((a, b) => String(a.period).localeCompare(String(b.period))),
      materials: Array.from(mats),
    };
  }, [filtered.sales, filters.granularity]);

  const topItems = useMemo(
    () => groupSum(filtered.collections, "item_type", "quantity_collected").slice(0, 8),
    [filtered.collections],
  );
  const materialBreakdown = useMemo(
    () => groupSum(filtered.extractions, "material_type", "quantity_extracted_kg"),
    [filtered.extractions],
  );
  const salesByMaterial = useMemo(
    () => groupSum(filtered.sales, "material_type", "total_received"),
    [filtered.sales],
  );
  const profit = useMemo(() => profitabilityByItem(filtered), [filtered]);
  const inventoryView = useMemo(
    () =>
      [...data.inventory]
        .filter((i) => !filters.material_type || i.material_type === filters.material_type)
        .filter((i) => !filters.grade || i.grade === filters.grade),
    [data.inventory, filters.material_type, filters.grade],
  );
  const inventoryTreemap = useMemo(
    () =>
      inventoryView
        .map((i) => ({
          name: `${i.material_type} ${i.grade}`,
          size: Math.max(i.estimated_market_value, 1),
          material: i.material_type,
        }))
        .slice(0, 24),
    [inventoryView],
  );
  const areaPerf = useMemo(() => {
    const byArea = new Map<string, { revenue: number; cost: number; items: number }>();
    // attribute revenue via batches → area
    const batchToArea = new Map<string, string>();
    for (const c of filtered.collections) batchToArea.set(c.batch_id, c.area);
    const batchRevenue = new Map<string, number>();
    for (const s of filtered.sales) batchRevenue.set(s.batch_id, (batchRevenue.get(s.batch_id) ?? 0) + s.total_received);
    for (const c of filtered.collections) {
      const cur = byArea.get(c.area) ?? { revenue: 0, cost: 0, items: 0 };
      cur.cost += c.purchase_cost + c.transport_cost + c.labour_cost;
      cur.items += c.quantity_collected;
      byArea.set(c.area, cur);
    }
    // distribute sales proportionally to extraction value per area
    const valueByArea = new Map<string, number>();
    for (const e of filtered.extractions) {
      const a = batchToArea.get(e.batch_id);
      if (!a) continue;
      valueByArea.set(a, (valueByArea.get(a) ?? 0) + e.estimated_value);
    }
    const totalExtractValue = Array.from(valueByArea.values()).reduce((s, v) => s + v, 0) || 1;
    const totalSales = filtered.sales.reduce((s, x) => s + x.total_received, 0);
    for (const [a, v] of valueByArea) {
      const cur = byArea.get(a) ?? { revenue: 0, cost: 0, items: 0 };
      cur.revenue = (v / totalExtractValue) * totalSales;
      byArea.set(a, cur);
    }
    return Array.from(byArea.entries())
      .map(([area, v]) => ({ area, revenue: Math.round(v.revenue), cost: Math.round(v.cost), items: v.items }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const buyerPerf = useMemo(() => {
    const map = new Map<string, { kg: number; rev: number; deals: number }>();
    for (const s of filtered.sales) {
      const cur = map.get(s.buyer) ?? { kg: 0, rev: 0, deals: 0 };
      cur.kg += s.quantity_sold_kg;
      cur.rev += s.total_received;
      cur.deals += 1;
      map.set(s.buyer, cur);
    }
    return Array.from(map.entries())
      .map(([buyer, v]) => ({ buyer, kg: Math.round(v.kg), rev: Math.round(v.rev), deals: v.deals, avg: +(v.rev / v.kg).toFixed(2) }))
      .sort((a, b) => b.rev - a.rev);
  }, [filtered.sales]);

  const yieldEff = useMemo(() => expectedVsActualYield(filtered), [filtered]);
  const funnel = useMemo(() => recoveryFunnel(filtered), [filtered]);

  const insights = useMemo(() => generateInsights(filtered, prevFiltered), [filtered, prevFiltered]);

  // ---- Table column defs ----
  const collectionsCols: Column<Collection>[] = [
    { key: "collection_date", label: "Date" },
    { key: "area", label: "Area" },
    { key: "suburb", label: "Suburb" },
    { key: "item_type", label: "Item" },
    { key: "quantity_collected", label: "Qty", align: "right" },
    { key: "estimated_item_weight_kg", label: "Weight", align: "right", format: (v) => KG(Number(v)) },
    {
      key: "purchase_cost",
      label: "Cost",
      align: "right",
      format: (_, r) => ZAR(r.purchase_cost + r.transport_cost + r.labour_cost),
      sortValue: (r) => r.purchase_cost + r.transport_cost + r.labour_cost,
    },
    { key: "supplier_name", label: "Supplier" },
    { key: "batch_id", label: "Batch" },
  ];
  const extractionCols: Column<Extraction>[] = [
    { key: "extraction_date", label: "Date" },
    { key: "source_item_type", label: "Source item" },
    { key: "material_type", label: "Material" },
    { key: "grade", label: "Grade", align: "center" },
    { key: "quantity_extracted_kg", label: "Qty", align: "right", format: (v) => KG(Number(v)) },
    { key: "recovery_rate_pct", label: "Recovery", align: "right", format: (v) => PCT(Number(v)), bar: (r) => r.recovery_rate_pct / 100 },
    { key: "estimated_value", label: "Est. value", align: "right", format: (v) => ZAR(Number(v)) },
    { key: "batch_id", label: "Batch" },
  ];
  const salesCols: Column<Sale>[] = [
    { key: "sale_date", label: "Date" },
    { key: "buyer", label: "Buyer" },
    { key: "material_type", label: "Material" },
    { key: "grade", label: "Grade", align: "center" },
    { key: "quantity_sold_kg", label: "Qty", align: "right", format: (v) => KG(Number(v)) },
    { key: "price_per_kg", label: "Price/kg", align: "right", format: (v) => ZAR(Number(v)) },
    { key: "total_received", label: "Total", align: "right", format: (v) => ZAR(Number(v)) },
    {
      key: "payment_status",
      label: "Status",
      align: "center",
      format: (v) => {
        const s = String(v);
        const cls =
          s === "Paid" ? "bg-success/15 text-success"
            : s === "Pending" ? "bg-warning/15 text-warning"
            : "bg-destructive/15 text-destructive";
        return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{s}</span>;
      },
    },
  ];
  const inventoryCols: Column<InventoryRow>[] = [
    { key: "material_type", label: "Material" },
    { key: "grade", label: "Grade", align: "center" },
    { key: "current_stock_kg", label: "Stock", align: "right", format: (v) => KG(Number(v)) },
    { key: "average_cost_per_kg", label: "Avg cost/kg", align: "right", format: (v) => ZAR(Number(v)) },
    {
      key: "estimated_market_value",
      label: "Market value",
      align: "right",
      format: (v) => ZAR(Number(v)),
      bar: (r) => {
        const max = Math.max(...inventoryView.map((i) => i.estimated_market_value), 1);
        return r.estimated_market_value / max;
      },
    },
    { key: "last_updated", label: "Updated" },
  ];

  const profitCols: Column<(typeof profit)[number]>[] = [
    { key: "item", label: "Item" },
    { key: "items", label: "Units", align: "right", format: (v) => NUM(Number(v)) },
    { key: "copperPerItem", label: "Copper/unit", align: "right", format: (v) => `${Number(v).toFixed(2)} kg` },
    { key: "revenue", label: "Revenue", align: "right", format: (v) => ZAR(Number(v)) },
    { key: "cost", label: "Cost", align: "right", format: (v) => ZAR(Number(v)) },
    { key: "profit", label: "Profit", align: "right", format: (v) => ZAR(Number(v)), bar: (r) => {
        const max = Math.max(...profit.map((p) => Math.abs(p.profit)), 1);
        return Math.max(0, r.profit) / max;
      } },
    { key: "margin", label: "Margin", align: "right", format: (v) => PCT(Number(v)) },
  ];

  const matColor = (m: string, i = 0) => MATERIAL_COLORS[m] ?? CHART_COLORS[i % CHART_COLORS.length];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-md">
        <div className="container flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="relative grid place-items-center size-9 rounded-md bg-gradient-copper text-primary-foreground shadow-glow">
              <Flame className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold tracking-tight leading-none">
                <span className="text-copper">FORGE</span>
                <span className="text-foreground"> OPS</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">Copper & Mixed-Metal Recovery — Operations Centre</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-success animate-pulse-glow" />
              Live
            </span>
            <span>{filters.from} → {filters.to}</span>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 animate-fade-in">
        {/* Upload */}
        <UploadPanel
          source={source}
          onLoaded={(d, src) => {
            setData(d);
            setSource(src);
            setFilters(defaultFilters(d));
          }}
          onResetDemo={() => {
            const demo = generateDemoData();
            setData(demo);
            setSource("demo");
            setFilters(defaultFilters(demo));
          }}
        />

        {/* Filters */}
        <FilterBar data={data} filters={filters} onChange={setFilters} />

        {/* KPIs */}
        <section className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Items Collected"
            value={NUM(kpis.itemsCollected)}
            delta={pctChange(kpis.itemsCollected, prevKpis.itemsCollected)}
            trend={collectionsTS}
            icon={<Truck className="size-4" />}
            highlight
          />
          <KpiCard
            label="Copper Extracted"
            value={KG(kpis.copperKg)}
            delta={pctChange(kpis.copperKg, prevKpis.copperKg)}
            trend={copperTS}
            icon={<Factory className="size-4" />}
          />
          <KpiCard
            label="Metals Sold"
            value={KG(kpis.metalsSoldKg)}
            delta={pctChange(kpis.metalsSoldKg, prevKpis.metalsSoldKg)}
            trend={salesKgTS}
            icon={<ShoppingCart className="size-4" />}
          />
          <KpiCard
            label="Revenue"
            value={ZAR(kpis.revenue)}
            delta={pctChange(kpis.revenue, prevKpis.revenue)}
            trend={revenueTS}
            icon={<Wallet className="size-4" />}
          />
          <KpiCard
            label="Stock on Hand Value"
            value={ZAR(kpis.stockValue)}
            hint={`${KG(data.inventory.reduce((s, i) => s + i.current_stock_kg, 0))} across ${data.inventory.length} lines`}
            icon={<Package className="size-4" />}
          />
        </section>

        <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <KpiCard
            label="Gross Profit"
            value={ZAR(kpis.grossProfit)}
            delta={pctChange(kpis.grossProfit, prevKpis.grossProfit)}
            hint={`Revenue − collection costs`}
            icon={<Coins className="size-4" />}
          />
          <KpiCard
            label="Recovery Efficiency"
            value={PCT(kpis.recoveryEff)}
            delta={pctChange(kpis.recoveryEff, prevKpis.recoveryEff)}
            icon={<Gauge className="size-4" />}
          />
          <KpiCard
            label="Conversion Rate"
            value={PCT(kpis.conversionRate)}
            hint="Extracted → sold"
            icon={<Activity className="size-4" />}
          />
          <KpiCard
            label="Avg Revenue / Day"
            value={ZAR(kpis.avgRevPerDay)}
            delta={pctChange(kpis.avgRevPerDay, prevKpis.avgRevPerDay)}
            icon={<BarChart3 className="size-4" />}
          />
        </section>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-muted/40 border border-border/60">
            <TabsTrigger value="overview"><BarChart3 className="size-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="collections"><Truck className="size-3.5" />Collections</TabsTrigger>
            <TabsTrigger value="extraction"><Factory className="size-3.5" />Extraction</TabsTrigger>
            <TabsTrigger value="sales"><ShoppingCart className="size-3.5" />Sales</TabsTrigger>
            <TabsTrigger value="inventory"><Boxes className="size-3.5" />Inventory</TabsTrigger>
            <TabsTrigger value="insights"><Sparkles className="size-3.5" />Insights</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Revenue & Sales Volume" subtitle="Money in vs kilograms shipped" className="lg:col-span-2">
                <ResponsiveContainer>
                  <ComposedChart data={revenueTS.map((r, i) => ({ ...r, kg: salesKgTS[i]?.value ?? 0 }))}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="period" {...axisProps} />
                    <YAxis yAxisId="left" {...axisProps} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" {...axisProps} tickFormatter={(v) => `${v}kg`} />
                    <Tooltip content={<DarkTooltip valueFormatter={(v) => moneyFmt(v)} />} />
                    <Bar yAxisId="left" dataKey="value" name="Revenue" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="kg" name="Sold (kg)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Recovery Funnel" subtitle="Collected → extracted → sold → on hand">
                <ResponsiveContainer>
                  <FunnelChart>
                    <Tooltip content={<DarkTooltip valueFormatter={kgFmt} />} />
                    <Funnel dataKey="value" data={funnel} isAnimationActive>
                      {funnel.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="stage" fontSize={12} />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Top Collected Items" subtitle="By units in selected period">
                <ResponsiveContainer>
                  <BarChart data={topItems} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" horizontal={false} />
                    <XAxis type="number" {...axisProps} />
                    <YAxis dataKey="name" type="category" width={130} {...axisProps} />
                    <Tooltip content={<DarkTooltip valueFormatter={(v) => `${v} units`} />} />
                    <Bar dataKey="value" name="Units" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Material Extraction Mix" subtitle="kg recovered by material">
                <ResponsiveContainer>
                  <BarChart data={materialBreakdown}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="name" {...axisProps} angle={-20} textAnchor="end" height={60} interval={0} />
                    <YAxis {...axisProps} tickFormatter={(v) => `${v}kg`} />
                    <Tooltip content={<DarkTooltip valueFormatter={kgFmt} />} />
                    <Bar dataKey="value" name="kg" radius={[3, 3, 0, 0]}>
                      {materialBreakdown.map((m, i) => <Cell key={m.name} fill={matColor(m.name, i)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Revenue by Material" subtitle="Where the money came from">
                <ResponsiveContainer>
                  <BarChart data={salesByMaterial.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={110} {...axisProps} />
                    <Tooltip content={<DarkTooltip valueFormatter={moneyFmt} />} />
                    <Bar dataKey="value" name="Revenue" radius={[0, 4, 4, 0]}>
                      {salesByMaterial.map((m, i) => <Cell key={m.name} fill={matColor(m.name, i)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Sales Mix Over Time" subtitle="Stacked revenue by material" className="lg:col-span-2">
                <ResponsiveContainer>
                  <BarChart data={salesByMaterialTS.data}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="period" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<DarkTooltip valueFormatter={moneyFmt} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {salesByMaterialTS.materials.map((m, i) => (
                      <Bar key={m} dataKey={m} stackId="rev" fill={matColor(m, i)} radius={i === salesByMaterialTS.materials.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Inventory by Material" subtitle="Treemap by market value">
                <ResponsiveContainer>
                  <Treemap
                    data={inventoryTreemap}
                    dataKey="size"
                    stroke="hsl(var(--background))"
                    content={<TreemapNode />}
                  />
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <InsightPanel insights={insights} />
          </TabsContent>

          {/* COLLECTIONS */}
          <TabsContent value="collections" className="space-y-4 mt-0">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Collection Trend" subtitle="Items collected over time" className="lg:col-span-2">
                <ResponsiveContainer>
                  <BarChart data={collectionsTS}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="period" {...axisProps} />
                    <YAxis {...axisProps} />
                    <Tooltip content={<DarkTooltip valueFormatter={(v) => `${v} units`} />} />
                    <Bar dataKey="value" name="Items" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Area Performance" subtitle="Revenue attributed by collection area">
                <ResponsiveContainer>
                  <BarChart data={areaPerf} layout="vertical">
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="area" type="category" width={120} {...axisProps} />
                    <Tooltip content={<DarkTooltip valueFormatter={moneyFmt} />} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <DataTable
              title="Collections log"
              columns={collectionsCols}
              rows={filtered.collections}
              exportName="collections.csv"
            />
          </TabsContent>

          {/* EXTRACTION */}
          <TabsContent value="extraction" className="space-y-4 mt-0">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Yield Efficiency" subtitle="Collected weight vs extracted material per source item">
                <ResponsiveContainer>
                  <ScatterChart>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" />
                    <XAxis type="number" dataKey="collectedKg" name="Collected" {...axisProps} tickFormatter={(v) => `${v}kg`} />
                    <YAxis type="number" dataKey="extractedKg" name="Extracted" {...axisProps} tickFormatter={(v) => `${v}kg`} />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as { item: string; collectedKg: number; extractedKg: number; yieldPct: number };
                        return (
                          <div className="rounded-md border border-border/80 bg-popover/95 backdrop-blur px-3 py-2 shadow-elevate text-xs">
                            <div className="font-medium">{p.item}</div>
                            <div className="text-muted-foreground">Collected: {KG(p.collectedKg)}</div>
                            <div className="text-muted-foreground">Extracted: {KG(p.extractedKg)}</div>
                            <div className="text-foreground">Yield: {PCT(p.yieldPct)}</div>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={yieldEff} fill="hsl(var(--chart-1))" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Profitability by Source Item" subtitle="Top profit contributors">
                <ResponsiveContainer>
                  <BarChart data={profit.slice(0, 10)} layout="vertical">
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="item" type="category" width={130} {...axisProps} />
                    <Tooltip content={<DarkTooltip valueFormatter={moneyFmt} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="cost" name="Cost" stackId="x" fill="hsl(var(--chart-6))" />
                    <Bar dataKey="profit" name="Profit" stackId="x" fill="hsl(var(--chart-1))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <DataTable title="Extractions log" columns={extractionCols} rows={filtered.extractions} exportName="extractions.csv" />
          </TabsContent>

          {/* SALES */}
          <TabsContent value="sales" className="space-y-4 mt-0">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Buyer Performance" subtitle="Revenue & deals by buyer" className="lg:col-span-2">
                <ResponsiveContainer>
                  <BarChart data={buyerPerf}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="buyer" {...axisProps} angle={-15} textAnchor="end" height={60} interval={0} />
                    <YAxis yAxisId="l" {...axisProps} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="r" orientation="right" {...axisProps} />
                    <Tooltip content={<DarkTooltip valueFormatter={(v) => moneyFmt(v)} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="l" dataKey="rev" name="Revenue" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="r" dataKey="deals" name="Deals" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Avg Price per kg" subtitle="By buyer">
                <ResponsiveContainer>
                  <BarChart data={buyerPerf} layout="vertical">
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" horizontal={false} />
                    <XAxis type="number" {...axisProps} tickFormatter={(v) => `R${v}`} />
                    <YAxis dataKey="buyer" type="category" width={120} {...axisProps} />
                    <Tooltip content={<DarkTooltip valueFormatter={moneyFmt} />} />
                    <Bar dataKey="avg" name="Avg R/kg" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <DataTable title="Sales log" columns={salesCols} rows={filtered.sales} exportName="sales.csv" />
          </TabsContent>

          {/* INVENTORY */}
          <TabsContent value="inventory" className="space-y-4 mt-0">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartCard title="Stock by Material" subtitle="Current kg on hand" className="lg:col-span-2">
                <ResponsiveContainer>
                  <BarChart data={inventoryView.map((i) => ({ name: `${i.material_type} ${i.grade}`, kg: i.current_stock_kg, value: i.estimated_market_value, material: i.material_type }))}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="name" {...axisProps} angle={-25} textAnchor="end" height={70} interval={0} fontSize={10} />
                    <YAxis {...axisProps} tickFormatter={(v) => `${v}kg`} />
                    <Tooltip content={<DarkTooltip valueFormatter={kgFmt} />} />
                    <Bar dataKey="kg" name="Stock" radius={[3, 3, 0, 0]}>
                      {inventoryView.map((i, idx) => <Cell key={idx} fill={matColor(i.material_type, idx)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Inventory Value" subtitle="Treemap of market value">
                <ResponsiveContainer>
                  <Treemap
                    data={inventoryTreemap}
                    dataKey="size"
                    stroke="hsl(var(--background))"
                    content={<TreemapNode />}
                  />
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <DataTable title="Stock on hand" columns={inventoryCols} rows={inventoryView} exportName="inventory.csv" />
          </TabsContent>

          {/* INSIGHTS */}
          <TabsContent value="insights" className="space-y-4 mt-0">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2"><InsightPanel insights={insights} /></div>
              <ChartCard title="Area Spend vs Revenue" subtitle="Where collection effort pays back" height={300}>
                <ResponsiveContainer>
                  <BarChart data={areaPerf}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="area" {...axisProps} angle={-15} textAnchor="end" height={60} interval={0} fontSize={10} />
                    <YAxis {...axisProps} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<DarkTooltip valueFormatter={moneyFmt} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="cost" name="Cost" fill="hsl(var(--chart-6))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <DataTable
              title="Top profit contributors"
              columns={profitCols}
              rows={profit}
              exportName="profitability.csv"
            />
          </TabsContent>
        </Tabs>

        <footer className="pt-2 pb-6 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <MapPin className="size-3" /> Forge OPS · client-side dashboard · {source === "demo" ? "running on seeded demo data" : "running on your uploaded data"}
        </footer>
      </main>
    </div>
  );
};

// Custom treemap node — copper-tinted, with material color
function TreemapNode(props: unknown) {
  const p = props as {
    x: number; y: number; width: number; height: number;
    name?: string; material?: string; index?: number;
  };
  const fill = p.material ? matColorStatic(p.material, p.index ?? 0) : CHART_COLORS[(p.index ?? 0) % CHART_COLORS.length];
  return (
    <g>
      <rect
        x={p.x} y={p.y} width={p.width} height={p.height}
        fill={fill}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        opacity={0.92}
      />
      {p.width > 60 && p.height > 28 && p.name && (
        <text x={p.x + 6} y={p.y + 16} fill="hsl(var(--background))" fontSize={11} fontWeight={600}>
          {p.name}
        </text>
      )}
    </g>
  );
}
function matColorStatic(m: string, i: number) {
  return MATERIAL_COLORS[m] ?? CHART_COLORS[i % CHART_COLORS.length];
}

export default Index;
