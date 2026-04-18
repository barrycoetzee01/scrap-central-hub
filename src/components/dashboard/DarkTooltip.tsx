// Custom dark tooltip for recharts
import type { TooltipProps } from "recharts";
import { ZAR } from "@/lib/analytics";

interface Props extends TooltipProps<number, string> {
  valueFormatter?: (v: number) => string;
}

export function DarkTooltip({ active, payload, label, valueFormatter }: Props) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString("en-ZA", { maximumFractionDigits: 1 }));
  return (
    <div className="rounded-md border border-border/80 bg-popover/95 backdrop-blur px-3 py-2 shadow-elevate text-xs">
      {label != null && <div className="text-muted-foreground mb-1">{String(label)}</div>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ background: p.color }} />
            <span className="text-foreground/80">{p.name}</span>
            <span className="ml-auto font-medium text-foreground">{fmt(Number(p.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const moneyFmt = (v: number) => ZAR(v);
export const kgFmt = (v: number) => `${v.toLocaleString("en-ZA", { maximumFractionDigits: 1 })} kg`;
