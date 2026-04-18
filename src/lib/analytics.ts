// Calculation, filtering, and insight helpers
import type { Collection, DataSet, Extraction, Sale } from "./types";

export const ZAR = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n || 0);
export const KG = (n: number) => `${(n || 0).toLocaleString("en-ZA", { maximumFractionDigits: 1 })} kg`;
export const NUM = (n: number) => (n || 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
export const PCT = (n: number) => `${(n || 0).toFixed(1)}%`;

export interface Filters {
  from: string; // ISO date
  to: string;
  area?: string;
  suburb?: string;
  item_category?: string;
  item_type?: string;
  material_type?: string;
  buyer?: string;
  source_type?: string;
  grade?: string;
  payment_status?: string;
  granularity: "day" | "week" | "month" | "quarter";
}

export function defaultFilters(data: DataSet): Filters {
  const allDates = [
    ...data.collections.map((c) => c.collection_date),
    ...data.extractions.map((e) => e.extraction_date),
    ...data.sales.map((s) => s.sale_date),
  ].sort();
  return {
    from: allDates[0] ?? new Date().toISOString().slice(0, 10),
    to: allDates[allDates.length - 1] ?? new Date().toISOString().slice(0, 10),
    granularity: "week",
  };
}

const inRange = (d: string, f: Filters) => d >= f.from && d <= f.to;

export function applyFilters(data: DataSet, f: Filters): DataSet {
  const collections = data.collections.filter(
    (c) =>
      inRange(c.collection_date, f) &&
      (!f.area || c.area === f.area) &&
      (!f.suburb || c.suburb === f.suburb) &&
      (!f.item_category || c.item_category === f.item_category) &&
      (!f.item_type || c.item_type === f.item_type) &&
      (!f.source_type || c.source_type === f.source_type),
  );
  const extractions = data.extractions.filter(
    (e) =>
      inRange(e.extraction_date, f) &&
      (!f.material_type || e.material_type === f.material_type) &&
      (!f.grade || e.grade === f.grade) &&
      (!f.item_type || e.source_item_type === f.item_type),
  );
  const sales = data.sales.filter(
    (s) =>
      inRange(s.sale_date, f) &&
      (!f.material_type || s.material_type === f.material_type) &&
      (!f.grade || s.grade === f.grade) &&
      (!f.buyer || s.buyer === f.buyer) &&
      (!f.payment_status || s.payment_status === f.payment_status),
  );
  return { collections, extractions, sales, inventory: data.inventory };
}

// ---- Period helpers ----
export function priorPeriod(f: Filters): Filters {
  const fromD = new Date(f.from);
  const toD = new Date(f.to);
  const span = toD.getTime() - fromD.getTime();
  const prevTo = new Date(fromD.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { ...f, from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}

export function bucketKey(date: string, g: Filters["granularity"]): string {
  const d = new Date(date);
  if (g === "day") return date;
  if (g === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (g === "quarter") return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  // week (ISO week number-ish)
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---- Aggregations ----
export function timeSeries<T>(rows: T[], dateField: keyof T, valueField: keyof T, g: Filters["granularity"]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = bucketKey(String(r[dateField]), g);
    map.set(k, (map.get(k) ?? 0) + Number(r[valueField] ?? 0));
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ period: k, value: Number(v.toFixed(2)) }));
}

export function groupSum<T>(rows: T[], field: keyof T, valueField: keyof T): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = String(r[field] ?? "Unknown");
    map.set(key, (map.get(key) ?? 0) + Number(r[valueField] ?? 0));
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

// ---- KPI ----
export interface KpiSet {
  itemsCollected: number;
  copperKg: number;
  metalsSoldKg: number;
  revenue: number;
  stockValue: number;
  collectionCost: number;
  grossProfit: number;
  recoveryEff: number;
  conversionRate: number;
  avgRevPerDay: number;
}

export function computeKpis(d: DataSet): KpiSet {
  const itemsCollected = d.collections.reduce((s, c) => s + c.quantity_collected, 0);
  const copperKg = d.extractions.filter((e) => e.material_type === "Copper").reduce((s, e) => s + e.quantity_extracted_kg, 0);
  const metalsSoldKg = d.sales.reduce((s, x) => s + x.quantity_sold_kg, 0);
  const revenue = d.sales.reduce((s, x) => s + x.total_received, 0);
  const stockValue = d.inventory.reduce((s, i) => s + i.estimated_market_value, 0);
  const collectionCost = d.collections.reduce((s, c) => s + c.purchase_cost + c.transport_cost + c.labour_cost, 0);
  const grossProfit = revenue - collectionCost;
  const totalExtractedKg = d.extractions.reduce((s, e) => s + e.quantity_extracted_kg, 0);
  const totalRecoveryWeighted = d.extractions.reduce((s, e) => s + e.recovery_rate_pct * e.quantity_extracted_kg, 0);
  const recoveryEff = totalExtractedKg ? totalRecoveryWeighted / totalExtractedKg : 0;
  const conversionRate = totalExtractedKg ? (metalsSoldKg / totalExtractedKg) * 100 : 0;
  const days = new Set(d.sales.map((s) => s.sale_date)).size || 1;
  const avgRevPerDay = revenue / days;
  return {
    itemsCollected, copperKg, metalsSoldKg, revenue, stockValue,
    collectionCost, grossProfit, recoveryEff, conversionRate, avgRevPerDay,
  };
}

export function pctChange(curr: number, prev: number): number {
  if (!prev) return curr ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ---- Profitability per source item ----
export function profitabilityByItem(d: DataSet) {
  // Map batch -> collection cost, items
  const batchCost = new Map<string, { cost: number; itemType: string; qty: number }>();
  for (const c of d.collections) {
    const e = batchCost.get(c.batch_id) ?? { cost: 0, itemType: c.item_type, qty: 0 };
    e.cost += c.purchase_cost + c.transport_cost + c.labour_cost;
    e.qty += c.quantity_collected;
    e.itemType = c.item_type;
    batchCost.set(c.batch_id, e);
  }
  // Map batch -> extracted value and copper kg
  const batchExtract = new Map<string, { value: number; copper: number }>();
  for (const e of d.extractions) {
    const cur = batchExtract.get(e.batch_id) ?? { value: 0, copper: 0 };
    cur.value += e.estimated_value;
    if (e.material_type === "Copper") cur.copper += e.quantity_extracted_kg;
    batchExtract.set(e.batch_id, cur);
  }
  // Aggregate by item type
  const map = new Map<string, { revenue: number; cost: number; copper: number; items: number }>();
  for (const [batch, info] of batchCost) {
    const ext = batchExtract.get(batch) ?? { value: 0, copper: 0 };
    const cur = map.get(info.itemType) ?? { revenue: 0, cost: 0, copper: 0, items: 0 };
    cur.revenue += ext.value;
    cur.cost += info.cost;
    cur.copper += ext.copper;
    cur.items += info.qty;
    map.set(info.itemType, cur);
  }
  return Array.from(map.entries())
    .map(([item, v]) => ({
      item,
      revenue: Math.round(v.revenue),
      cost: Math.round(v.cost),
      profit: Math.round(v.revenue - v.cost),
      copperPerItem: v.items ? +(v.copper / v.items).toFixed(2) : 0,
      items: v.items,
      margin: v.revenue ? +(((v.revenue - v.cost) / v.revenue) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

// ---- Recovery funnel ----
export function recoveryFunnel(d: DataSet) {
  const collectedKg = d.collections.reduce((s, c) => s + c.estimated_item_weight_kg, 0);
  const extractedKg = d.extractions.reduce((s, e) => s + e.quantity_extracted_kg, 0);
  const soldKg = d.sales.reduce((s, x) => s + x.quantity_sold_kg, 0);
  const stockKg = d.inventory.reduce((s, i) => s + i.current_stock_kg, 0);
  return [
    { stage: "Collected", value: Math.round(collectedKg) },
    { stage: "Extracted", value: Math.round(extractedKg) },
    { stage: "Sold", value: Math.round(soldKg) },
    { stage: "On Hand", value: Math.round(stockKg) },
  ];
}

// ---- Insights generator ----
export function generateInsights(d: DataSet, prev: DataSet): string[] {
  const insights: string[] = [];
  if (!d.collections.length && !d.sales.length) {
    return ["No data in the selected range. Widen the date filter or upload a dataset."];
  }
  const kpis = computeKpis(d);
  const prevKpis = computeKpis(prev);

  // Best item by copper yield
  const profit = profitabilityByItem(d);
  if (profit.length) {
    const bestProfit = profit[0];
    insights.push(
      `${bestProfit.item} delivered the highest gross profit at ${ZAR(bestProfit.profit)} across ${bestProfit.items} units (margin ${bestProfit.margin}%).`,
    );
    const bestCopper = [...profit].sort((a, b) => b.copperPerItem - a.copperPerItem)[0];
    if (bestCopper.copperPerItem > 0) {
      insights.push(
        `${bestCopper.item} produced the highest copper yield per unit at ${bestCopper.copperPerItem} kg — prioritise sourcing more of these.`,
      );
    }
    const worst = profit.filter((p) => p.items >= 3).sort((a, b) => a.margin - b.margin)[0];
    if (worst && worst.margin < 25) {
      insights.push(
        `${worst.item} is underperforming with only ${worst.margin}% margin. Renegotiate purchase price or reduce intake.`,
      );
    }
  }

  // Area performance
  const byArea = groupSum(d.collections, "area" as never, "purchase_cost" as never);
  const collectionsByArea = new Map<string, number>();
  for (const c of d.collections) collectionsByArea.set(c.area, (collectionsByArea.get(c.area) ?? 0) + c.quantity_collected);
  if (byArea.length) {
    const top = byArea[0];
    insights.push(`${top.name} is your strongest collection area by spend at ${ZAR(top.value)} — consider increasing pickup frequency.`);
  }

  // Material price trend (compare current vs prior avg price for top material)
  const byMatSales = groupSum(d.sales, "material_type" as never, "total_received" as never);
  if (byMatSales.length) {
    const topMat = byMatSales[0].name;
    const currPrices = d.sales.filter((s) => s.material_type === topMat);
    const prevPrices = prev.sales.filter((s) => s.material_type === topMat);
    if (currPrices.length && prevPrices.length) {
      const cAvg = currPrices.reduce((s, x) => s + x.price_per_kg, 0) / currPrices.length;
      const pAvg = prevPrices.reduce((s, x) => s + x.price_per_kg, 0) / prevPrices.length;
      const delta = ((cAvg - pAvg) / pAvg) * 100;
      if (Math.abs(delta) > 3) {
        insights.push(
          `Average ${topMat} price has ${delta > 0 ? "risen" : "dropped"} ${Math.abs(delta).toFixed(1)}% versus the prior period (${ZAR(pAvg)} → ${ZAR(cAvg)} per kg).`,
        );
      }
    }
  }

  // Slow stock — highest kg, lowest sale velocity
  if (d.inventory.length) {
    const slow = [...d.inventory].sort((a, b) => b.current_stock_kg - a.current_stock_kg)[0];
    insights.push(
      `Largest stockpile is ${slow.material_type} (Grade ${slow.grade}) at ${KG(slow.current_stock_kg)} worth ${ZAR(slow.estimated_market_value)}. Consider scheduling a sale.`,
    );
  }

  // Recovery anomalies
  const lowRecov = d.extractions.filter((e) => e.recovery_rate_pct < 78);
  if (lowRecov.length > 5) {
    const byItem = groupSum(lowRecov, "source_item_type" as never, "quantity_extracted_kg" as never);
    if (byItem[0]) insights.push(`Recovery rate is below 78% on ${byItem[0].name} — review your extraction process for this item.`);
  }

  // Revenue trend
  const revDelta = pctChange(kpis.revenue, prevKpis.revenue);
  if (Math.abs(revDelta) > 5) {
    insights.push(
      `Revenue is ${revDelta > 0 ? "up" : "down"} ${Math.abs(revDelta).toFixed(1)}% versus the prior period (${ZAR(prevKpis.revenue)} → ${ZAR(kpis.revenue)}).`,
    );
  }

  // Conversion warning
  if (kpis.conversionRate < 60 && kpis.copperKg > 0) {
    insights.push(`Only ${kpis.conversionRate.toFixed(0)}% of extracted material has been sold — stock is building up.`);
  }

  return insights.slice(0, 8);
}

// Build a weight-by-source-item map (used as expected from collections)
export function expectedVsActualYield(d: DataSet) {
  const collected = new Map<string, number>();
  for (const c of d.collections) collected.set(c.item_type, (collected.get(c.item_type) ?? 0) + c.estimated_item_weight_kg);
  const extracted = new Map<string, number>();
  for (const e of d.extractions) extracted.set(e.source_item_type, (extracted.get(e.source_item_type) ?? 0) + e.quantity_extracted_kg);
  const items = new Set([...collected.keys(), ...extracted.keys()]);
  return Array.from(items).map((item) => {
    const c = collected.get(item) ?? 0;
    const e = extracted.get(item) ?? 0;
    return { item, collectedKg: Math.round(c), extractedKg: Math.round(e), yieldPct: c ? +((e / c) * 100).toFixed(1) : 0 };
  });
}

// Quick uniques
export const uniques = <T,>(arr: T[], key: keyof T) =>
  Array.from(new Set(arr.map((x) => String(x[key])).filter(Boolean))).sort();
