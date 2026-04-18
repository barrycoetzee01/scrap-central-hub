import { useCallback, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, FileWarning, Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseFile, type ParseResult } from "@/lib/dataImport";
import type { DataSet } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onLoaded: (data: DataSet, source: "demo" | "upload") => void;
  onResetDemo: () => void;
  source: "demo" | "upload";
}

export function UploadPanel({ onLoaded, onResetDemo, source }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [last, setLast] = useState<ParseResult | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const result = await parseFile(file);
        setLast(result);
        const merged: DataSet = {
          collections: result.data.collections ?? [],
          extractions: result.data.extractions ?? [],
          sales: result.data.sales ?? [],
          inventory: result.data.inventory ?? [],
        };
        const totalRows =
          merged.collections.length + merged.extractions.length + merged.sales.length + merged.inventory.length;
        if (totalRows === 0) {
          toast({
            title: "No usable rows found",
            description: "We couldn't detect collections, extractions, sales or inventory tables.",
            variant: "destructive",
          });
          return;
        }
        onLoaded(merged, "upload");
        toast({
          title: "Data loaded",
          description: `${totalRows} rows imported across ${result.detected.length} sheet(s).`,
        });
      } catch (e) {
        toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
      }
    },
    [onLoaded, toast],
  );

  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex-1 cursor-pointer rounded-lg border-2 border-dashed border-border/70 bg-muted/30 px-5 py-6 text-center transition-smooth",
            "hover:border-primary/60 hover:bg-muted/50",
            drag && "border-primary bg-primary/5",
          )}
          role="button"
          aria-label="Upload data file"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-full bg-primary/10 p-3 text-primary ring-1 ring-primary/30">
              <Upload className="size-5" />
            </div>
            <div className="font-medium">Drag & drop or click to upload</div>
            <div className="text-xs text-muted-foreground max-w-md">
              CSV, Excel (.xlsx) or Google Sheets export. Workbooks with multiple sheets (Collections, Extractions, Sales, Inventory) are auto-detected.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:w-80">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground font-medium uppercase tracking-wider">
              <Info className="size-3.5" /> Required columns
            </div>
            <div><span className="text-foreground">Collections:</span> collection_date, item_type, quantity_collected</div>
            <div><span className="text-foreground">Extractions:</span> extraction_date, material_type, quantity_extracted_kg</div>
            <div><span className="text-foreground">Sales:</span> sale_date, material_type, quantity_sold_kg, price_per_kg</div>
            <div><span className="text-foreground">Inventory:</span> material_type, current_stock_kg</div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={onResetDemo}>
              <FileSpreadsheet className="size-4" /> Reset to demo data
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            Source: <span className={cn("font-medium", source === "upload" ? "text-success" : "text-accent")}>
              {source === "upload" ? "your upload" : "demo dataset"}
            </span>
          </div>
        </div>
      </div>

      {last && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {last.detected.map((d) => (
            <div key={d.sheet} className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-xs">
              <CheckCircle2 className="size-4 text-success" />
              <span className="font-medium">{d.sheet}</span>
              <span className="text-muted-foreground">→ {d.type} ({d.rows} rows)</span>
            </div>
          ))}
          {last.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs">
              <FileWarning className="size-4 text-warning" />
              <span className="text-warning-foreground/90">{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
