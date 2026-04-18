// CSV / XLSX parsing for Forge OPS uploads.
// Auto-detects table type from columns and normalises rows into our DataSet shape.
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Collection, DataSet, Extraction, InventoryRow, Sale } from "./types";

export interface ParseResult {
  data: Partial<DataSet>;
  warnings: string[];
  detected: { sheet: string; type: string; rows: number }[];
}

const COLLECTION_FIELDS = ["collection_date", "item_type", "quantity_collected"];
const EXTRACTION_FIELDS = ["extraction_date", "material_type", "quantity_extracted_kg"];
const SALES_FIELDS = ["sale_date", "material_type", "quantity_sold_kg", "price_per_kg"];
const INVENTORY_FIELDS = ["material_type", "current_stock_kg"];

const norm = (s: string) =>
  s
    .toString()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

function detectType(headers: string[]): "collections" | "extractions" | "sales" | "inventory" | null {
  const set = new Set(headers.map(norm));
  const score = (fields: string[]) => fields.filter((f) => set.has(f)).length;
  const candidates = [
    { type: "collections" as const, score: score(COLLECTION_FIELDS) },
    { type: "extractions" as const, score: score(EXTRACTION_FIELDS) },
    { type: "sales" as const, score: score(SALES_FIELDS) },
    { type: "inventory" as const, score: score(INVENTORY_FIELDS) },
  ].sort((a, b) => b.score - a.score);
  return candidates[0].score >= 2 ? candidates[0].type : null;
}

const num = (v: unknown) => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const date = (v: unknown) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  // try ISO first
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return s.slice(0, 10);
};

const id = () => Math.random().toString(36).slice(2, 10);

function rowsToCollections(rows: Record<string, unknown>[]): Collection[] {
  return rows.map((r) => {
    const get = (k: string) => r[k] ?? r[norm(k)];
    return {
      id: id(),
      collection_date: date(get("collection_date") ?? get("date")),
      area: str(get("area")),
      suburb: str(get("suburb")),
      source_type: str(get("source_type")) || "Household",
      supplier_name: str(get("supplier_name")) || "Unknown",
      item_category: str(get("item_category")) || "Misc",
      item_type: str(get("item_type")) || "Unknown",
      quantity_collected: num(get("quantity_collected")) || 1,
      estimated_item_weight_kg: num(get("estimated_item_weight_kg")) || num(get("weight_kg")),
      purchase_cost: num(get("purchase_cost")),
      transport_cost: num(get("transport_cost")),
      labour_cost: num(get("labour_cost")),
      batch_id: str(get("batch_id")) || `B-${id()}`,
      notes: str(get("notes")) || undefined,
    };
  });
}

function rowsToExtractions(rows: Record<string, unknown>[]): Extraction[] {
  return rows.map((r) => {
    const get = (k: string) => r[k] ?? r[norm(k)];
    return {
      id: id(),
      extraction_date: date(get("extraction_date") ?? get("date")),
      batch_id: str(get("batch_id")) || `B-${id()}`,
      source_item_type: str(get("source_item_type")) || "Unknown",
      material_type: str(get("material_type")) || "Mixed Metal",
      grade: str(get("grade")) || "B",
      quantity_extracted_kg: num(get("quantity_extracted_kg")),
      recovery_rate_pct: num(get("recovery_rate_pct")) || 80,
      estimated_value: num(get("estimated_value")),
      waste_generated_kg: num(get("waste_generated_kg")),
      notes: str(get("notes")) || undefined,
    };
  });
}

function rowsToSales(rows: Record<string, unknown>[]): Sale[] {
  return rows.map((r) => {
    const get = (k: string) => r[k] ?? r[norm(k)];
    const qty = num(get("quantity_sold_kg"));
    const price = num(get("price_per_kg"));
    const total = num(get("total_received")) || qty * price;
    const status = str(get("payment_status")).toLowerCase();
    return {
      id: id(),
      sale_date: date(get("sale_date") ?? get("date")),
      buyer: str(get("buyer")) || "Unknown",
      material_type: str(get("material_type")) || "Mixed Metal",
      grade: str(get("grade")) || "B",
      quantity_sold_kg: qty,
      price_per_kg: price,
      total_received: total,
      batch_id: str(get("batch_id")) || `S-${id()}`,
      payment_status: status.includes("pend") ? "Pending" : status.includes("part") ? "Partial" : "Paid",
      notes: str(get("notes")) || undefined,
    };
  });
}

function rowsToInventory(rows: Record<string, unknown>[]): InventoryRow[] {
  return rows.map((r) => {
    const get = (k: string) => r[k] ?? r[norm(k)];
    const stock = num(get("current_stock_kg"));
    const cost = num(get("average_cost_per_kg"));
    return {
      material_type: str(get("material_type")) || "Mixed Metal",
      grade: str(get("grade")) || "B",
      current_stock_kg: stock,
      average_cost_per_kg: cost,
      estimated_market_value: num(get("estimated_market_value")) || stock * (cost * 1.2),
      last_updated: date(get("last_updated")) || new Date().toISOString().slice(0, 10),
    };
  });
}

function ingestSheet(name: string, rows: Record<string, unknown>[], result: ParseResult) {
  if (!rows.length) return;
  // Normalise keys for detection
  const headers = Object.keys(rows[0]);
  const normHeaders = headers.map(norm);
  // also stash normalised copies on rows for the resolvers
  const normRows = rows.map((r) => {
    const out: Record<string, unknown> = { ...r };
    for (const h of headers) out[norm(h)] = r[h];
    return out;
  });
  // allow explicit sheet-name hints
  let type = detectType(normHeaders);
  const lower = name.toLowerCase();
  if (!type) {
    if (lower.includes("coll")) type = "collections";
    else if (lower.includes("extr")) type = "extractions";
    else if (lower.includes("sale")) type = "sales";
    else if (lower.includes("invent") || lower.includes("stock")) type = "inventory";
  }
  if (!type) {
    result.warnings.push(`Sheet "${name}" — could not detect table type. Required columns missing.`);
    return;
  }
  const data = result.data;
  if (type === "collections") data.collections = [...(data.collections ?? []), ...rowsToCollections(normRows)];
  if (type === "extractions") data.extractions = [...(data.extractions ?? []), ...rowsToExtractions(normRows)];
  if (type === "sales") data.sales = [...(data.sales ?? []), ...rowsToSales(normRows)];
  if (type === "inventory") data.inventory = [...(data.inventory ?? []), ...rowsToInventory(normRows)];
  result.detected.push({ sheet: name, type, rows: rows.length });
}

export async function parseFile(file: File): Promise<ParseResult> {
  const result: ParseResult = { data: {}, warnings: [], detected: [] };
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    await new Promise<void>((resolve) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (res) => {
          ingestSheet(file.name, res.data, result);
          if (res.errors.length)
            result.warnings.push(`${file.name}: ${res.errors.length} row(s) had parse warnings.`);
          resolve();
        },
      });
    });
    return result;
  }
  if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
      ingestSheet(sheetName, rows, result);
    }
    return result;
  }
  result.warnings.push(`Unsupported file type: .${ext}`);
  return result;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
