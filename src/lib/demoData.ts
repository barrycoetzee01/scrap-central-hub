import type { Collection, DataSet, Extraction, InventoryRow, Sale } from "./types";

// Deterministic PRNG so demo data is stable across reloads
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20251101);
const r = (min: number, max: number) => min + rand() * (max - min);
const ri = (min: number, max: number) => Math.floor(r(min, max + 1));
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const AREAS: { area: string; suburbs: string[] }[] = [
  { area: "Northern Suburbs", suburbs: ["Brackenfell", "Bellville", "Durbanville", "Parow"] },
  { area: "Southern Suburbs", suburbs: ["Wynberg", "Plumstead", "Tokai", "Diep River"] },
  { area: "Cape Town CBD", suburbs: ["Woodstock", "Salt River", "Observatory", "Maitland"] },
  { area: "West Coast", suburbs: ["Milnerton", "Table View", "Parklands"] },
  { area: "Helderberg", suburbs: ["Somerset West", "Strand", "Gordons Bay"] },
];

const SOURCE_TYPES = ["Household", "Contractor", "Small Business", "Drop-off", "Estate Clearance"];
const SUPPLIERS = [
  "ABC Plumbing", "Coastline Aircon", "Mike's Handyman", "BlueSky Estates",
  "Pinelands Drop-off", "Khayelitsha Pickup", "Atlantic Hotels", "Goldfish Pools",
  "Mr Naidoo", "Mrs van der Merwe", "Westside Demolitions", "Greenpoint Body Corp",
];

interface ItemSpec {
  type: string;
  category: string;
  weight: [number, number]; // kg range
  cost: [number, number]; // ZAR per unit
  // expected material yield kg per unit
  yield: Partial<Record<string, [number, number]>>;
}

const ITEMS: ItemSpec[] = [
  { type: "Washing Machine", category: "White Goods", weight: [55, 75], cost: [120, 280],
    yield: { Copper: [0.8, 1.6], Aluminium: [0.4, 1.0], Steel: [30, 45], Motors: [1, 1], "Mixed Metal": [3, 6] } },
  { type: "Tumble Dryer", category: "White Goods", weight: [35, 55], cost: [100, 220],
    yield: { Copper: [0.6, 1.2], Steel: [22, 35], Motors: [1, 1], "Mixed Metal": [2, 5] } },
  { type: "Dishwasher", category: "White Goods", weight: [40, 60], cost: [110, 240],
    yield: { Copper: [0.5, 1.1], "Stainless Steel": [4, 9], Steel: [18, 28], Motors: [1, 1] } },
  { type: "Microwave", category: "Small Appliances", weight: [10, 18], cost: [25, 70],
    yield: { Copper: [0.2, 0.5], Aluminium: [0.1, 0.3], Steel: [5, 9], Transformers: [1, 1] } },
  { type: "Fridge Compressor", category: "Compressors", weight: [9, 14], cost: [50, 110],
    yield: { Copper: [0.7, 1.3], Steel: [5, 8], Compressors: [1, 1] } },
  { type: "Pool Pump", category: "Pumps & Motors", weight: [12, 22], cost: [180, 380],
    yield: { Copper: [1.6, 3.2], Brass: [0.2, 0.6], Steel: [4, 7], Motors: [1, 1] } },
  { type: "Loose Electric Motor", category: "Pumps & Motors", weight: [4, 18], cost: [40, 160],
    yield: { Copper: [0.9, 3.0], Steel: [2, 8], Motors: [1, 1] } },
  { type: "Aircon Split Unit", category: "HVAC", weight: [25, 45], cost: [150, 420],
    yield: { Copper: [1.2, 2.8], Aluminium: [1.5, 3.5], Steel: [6, 12], Compressors: [1, 1] } },
  { type: "UPS Unit", category: "Electronics", weight: [10, 28], cost: [60, 160],
    yield: { Copper: [0.4, 1.0], Steel: [3, 7], Transformers: [1, 1], "E-waste Residue": [1, 3] } },
  { type: "Inverter Unit", category: "Electronics", weight: [4, 14], cost: [40, 130],
    yield: { Copper: [0.3, 0.9], Aluminium: [0.2, 0.6], Transformers: [1, 1], "E-waste Residue": [0.5, 2] } },
  { type: "Extension Cable Bundle", category: "Cables", weight: [3, 12], cost: [25, 110],
    yield: { "Insulated Wire": [3, 12], Copper: [1.2, 4.8] } },
  { type: "Power Tool", category: "Power Tools", weight: [2, 6], cost: [20, 70],
    yield: { Copper: [0.2, 0.6], Aluminium: [0.1, 0.4], Steel: [1, 3], Motors: [1, 1] } },
  { type: "Geyser", category: "White Goods", weight: [40, 70], cost: [80, 200],
    yield: { Copper: [0.4, 1.2], Steel: [25, 45] } },
  { type: "Vacuum Cleaner", category: "Small Appliances", weight: [4, 9], cost: [20, 60],
    yield: { Copper: [0.3, 0.7], Steel: [1.5, 3], Motors: [1, 1] } },
  { type: "Kettle", category: "Small Appliances", weight: [1, 2], cost: [3, 12],
    yield: { "Stainless Steel": [0.4, 1.0], Copper: [0.05, 0.15] } },
  { type: "Iron", category: "Small Appliances", weight: [1, 2], cost: [3, 10],
    yield: { Aluminium: [0.3, 0.6], Copper: [0.05, 0.15], Steel: [0.3, 0.6] } },
  { type: "Fan", category: "Small Appliances", weight: [3, 8], cost: [15, 45],
    yield: { Copper: [0.3, 0.8], Aluminium: [0.2, 0.5], Steel: [1, 2.5], Motors: [1, 1] } },
];

const BUYERS = [
  "Cape Metal Recyclers", "Atlantic Scrap Co.", "RedBull Metals", "SA Copper Buyers",
  "Boland Salvage", "Western Cape Alloys", "Harbour Yard",
];

// Material market prices per kg (ZAR)
const MATERIAL_PRICE: Record<string, number> = {
  Copper: 145,
  Aluminium: 32,
  Brass: 95,
  Steel: 4.5,
  "Stainless Steel": 22,
  "Insulated Wire": 55,
  Compressors: 18,
  Motors: 24,
  Transformers: 35,
  "Mixed Metal": 9,
  "E-waste Residue": 6,
};

const GRADES = ["A", "B", "C"];

const todayMinus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const id = () => Math.random().toString(36).slice(2, 10);
const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

export function generateDemoData(): DataSet {
  const collections: Collection[] = [];
  const extractions: Extraction[] = [];
  const sales: Sale[] = [];

  // 120 days of activity
  for (let day = 119; day >= 0; day--) {
    const dailyCollections = ri(2, 6);
    for (let c = 0; c < dailyCollections; c++) {
      const item = pick(ITEMS);
      const region = pick(AREAS);
      const qty = ri(1, item.category === "Cables" ? 6 : 3);
      const weight = round(r(item.weight[0], item.weight[1]) * qty, 1);
      const purchase = round(r(item.cost[0], item.cost[1]) * qty);
      const batch_id = `B${todayMinus(day).replace(/-/g, "")}-${ri(100, 999)}`;
      const collectionDate = todayMinus(day);
      collections.push({
        id: id(),
        collection_date: collectionDate,
        area: region.area,
        suburb: pick(region.suburbs),
        source_type: pick(SOURCE_TYPES),
        supplier_name: pick(SUPPLIERS),
        item_category: item.category,
        item_type: item.type,
        quantity_collected: qty,
        estimated_item_weight_kg: weight,
        purchase_cost: purchase,
        transport_cost: round(r(20, 120)),
        labour_cost: round(r(30, 160)),
        batch_id,
        notes: rand() < 0.15 ? "Mixed condition" : undefined,
      });

      // Extraction usually 1–4 days after collection
      if (rand() < 0.92) {
        const extractDay = Math.max(0, day - ri(1, 4));
        const extractionDate = todayMinus(extractDay);
        for (const [material, range] of Object.entries(item.yield)) {
          if (!range) continue;
          const baseYield = r(range[0], range[1]) * qty;
          const recovery = round(r(72, 96), 1);
          const actual = round(baseYield * (recovery / 100), 2);
          if (actual <= 0) continue;
          const grade = pick(GRADES);
          const valuePerKg = (MATERIAL_PRICE[material] ?? 10) * (grade === "A" ? 1 : grade === "B" ? 0.85 : 0.7);
          extractions.push({
            id: id(),
            extraction_date: extractionDate,
            batch_id,
            source_item_type: item.type,
            material_type: material,
            grade,
            quantity_extracted_kg: actual,
            recovery_rate_pct: recovery,
            estimated_value: round(actual * valuePerKg),
            waste_generated_kg: round(weight * r(0.05, 0.18), 1),
          });
        }
      }
    }
  }

  // Sales — sell ~80% of extracted material in batches
  const stockLedger: Record<string, { kg: number; cost: number }> = {};
  // accumulate stock from extractions
  for (const e of extractions) {
    const key = `${e.material_type}|${e.grade}`;
    const entry = stockLedger[key] ?? { kg: 0, cost: 0 };
    entry.kg += e.quantity_extracted_kg;
    entry.cost += e.estimated_value * 0.55; // assume cost basis ~55% of extracted value
    stockLedger[key] = entry;
  }

  // Generate ~3 sales per week
  for (let day = 110; day >= 0; day -= ri(2, 4)) {
    const sellsToday = ri(1, 3);
    for (let s = 0; s < sellsToday; s++) {
      const keys = Object.keys(stockLedger).filter((k) => stockLedger[k].kg > 2);
      if (!keys.length) continue;
      const key = pick(keys);
      const [material, grade] = key.split("|");
      const stock = stockLedger[key];
      const qty = round(Math.min(stock.kg * r(0.2, 0.5), r(8, 120)), 1);
      if (qty <= 0) continue;
      const basePrice = MATERIAL_PRICE[material] ?? 10;
      const gradeMult = grade === "A" ? 1 : grade === "B" ? 0.88 : 0.74;
      // simulate price movement
      const price = round(basePrice * gradeMult * r(0.92, 1.08), 2);
      const total = round(qty * price);
      stock.kg -= qty;
      sales.push({
        id: id(),
        sale_date: todayMinus(day),
        buyer: pick(BUYERS),
        material_type: material,
        grade,
        quantity_sold_kg: qty,
        price_per_kg: price,
        total_received: total,
        batch_id: `S${todayMinus(day).replace(/-/g, "")}-${ri(100, 999)}`,
        payment_status: rand() < 0.78 ? "Paid" : rand() < 0.6 ? "Pending" : "Partial",
      });
    }
  }

  // Inventory snapshot from remaining stockLedger
  const inventory: InventoryRow[] = Object.entries(stockLedger)
    .filter(([, v]) => v.kg > 0.1)
    .map(([key, v]) => {
      const [material, grade] = key.split("|");
      const avgCost = round(v.cost / Math.max(v.kg + 0.001, 1), 2);
      const market = (MATERIAL_PRICE[material] ?? 10) * (grade === "A" ? 1 : grade === "B" ? 0.88 : 0.74);
      return {
        material_type: material,
        grade,
        current_stock_kg: round(v.kg, 1),
        average_cost_per_kg: avgCost,
        estimated_market_value: round(v.kg * market),
        last_updated: todayMinus(0),
      };
    })
    .sort((a, b) => b.estimated_market_value - a.estimated_market_value);

  return { collections, extractions, sales, inventory };
}
