// Domain types for the Forge OPS recovery dashboard
export type ID = string;

export interface Collection {
  id: ID;
  collection_date: string; // ISO yyyy-mm-dd
  area: string;
  suburb: string;
  source_type: string; // e.g. household, contractor, business
  supplier_name: string;
  item_category: string; // e.g. White goods, Power tools, Cables
  item_type: string; // e.g. Washing machine
  quantity_collected: number;
  estimated_item_weight_kg: number;
  purchase_cost: number;
  transport_cost: number;
  labour_cost: number;
  batch_id: string;
  notes?: string;
}

export interface Extraction {
  id: ID;
  extraction_date: string;
  batch_id: string;
  source_item_type: string;
  material_type: string; // copper, aluminium, brass, etc.
  grade: string; // A, B, C, mixed
  quantity_extracted_kg: number;
  recovery_rate_pct: number;
  estimated_value: number;
  waste_generated_kg: number;
  notes?: string;
}

export interface Sale {
  id: ID;
  sale_date: string;
  buyer: string;
  material_type: string;
  grade: string;
  quantity_sold_kg: number;
  price_per_kg: number;
  total_received: number;
  batch_id: string;
  payment_status: "Paid" | "Pending" | "Partial";
  notes?: string;
}

export interface InventoryRow {
  material_type: string;
  grade: string;
  current_stock_kg: number;
  average_cost_per_kg: number;
  estimated_market_value: number;
  last_updated: string;
}

export interface DataSet {
  collections: Collection[];
  extractions: Extraction[];
  sales: Sale[];
  inventory: InventoryRow[];
}

export const MATERIAL_COLORS: Record<string, string> = {
  Copper: "hsl(var(--chart-1))",
  Aluminium: "hsl(var(--chart-3))",
  Brass: "hsl(var(--chart-4))",
  Steel: "hsl(var(--chart-6))",
  "Stainless Steel": "hsl(var(--chart-5))",
  "Insulated Wire": "hsl(var(--chart-2))",
  Compressors: "hsl(var(--chart-7))",
  Motors: "hsl(var(--chart-7))",
  Transformers: "hsl(var(--chart-2))",
  "Mixed Metal": "hsl(var(--chart-6))",
  "E-waste Residue": "hsl(var(--muted-foreground))",
};
