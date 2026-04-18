import { Lightbulb, Sparkles } from "lucide-react";

interface Props {
  insights: string[];
}

export function InsightPanel({ insights }: Props) {
  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 pb-3">
        <div className="rounded-md bg-primary/10 p-1.5 text-primary ring-1 ring-primary/30">
          <Sparkles className="size-4" />
        </div>
        <h3 className="font-display text-sm font-semibold tracking-tight">Deep Analysis</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">Generated from your filtered data</span>
      </div>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">No insights to surface yet — load more data or widen the date range.</p>
      ) : (
        <ul className="space-y-2.5">
          {insights.map((i, idx) => (
            <li
              key={idx}
              className="group flex gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 transition-smooth hover:border-primary/40 hover:bg-muted/40"
            >
              <Lightbulb className="size-4 mt-0.5 text-accent shrink-0 group-hover:scale-110 transition-transform" />
              <p className="text-sm leading-relaxed text-foreground/90">{i}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
