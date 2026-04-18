import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ResponsiveContainer, Sparkline as _SL } from "recharts";
import { Area, AreaChart } from "recharts";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number; // percent vs prior period
  hint?: string;
  trend?: { period: string; value: number }[];
  highlight?: boolean;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, delta, hint, trend, highlight, icon }: KpiCardProps) {
  const positive = (delta ?? 0) > 0.5;
  const negative = (delta ?? 0) < -0.5;
  return (
    <div
      className={cn(
        "surface relative overflow-hidden p-4 sm:p-5 transition-smooth hover:border-primary/40",
        highlight && "surface-glow",
      )}
    >
      <div className="absolute inset-0 grid-bg opacity-[0.07] pointer-events-none" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {icon && <div className="text-primary/80">{icon}</div>}
      </div>
      <div className="relative mt-3 flex items-end justify-between gap-3">
        {delta != null && (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              positive && "bg-success/15 text-success",
              negative && "bg-destructive/15 text-destructive",
              !positive && !negative && "bg-muted text-muted-foreground",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : negative ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
            <span className="text-muted-foreground/80 hidden sm:inline">vs prev</span>
          </div>
        )}
        {trend && trend.length > 1 && (
          <div className="h-10 flex-1 max-w-[120px] -mb-1 -mr-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill={`url(#spark-${label})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export to avoid unused import warnings (Sparkline isn't used directly)
void _SL;
