// Reusable chart card wrapper
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  height?: number;
}

export function ChartCard({ title, subtitle, action, children, className, height = 280 }: Props) {
  return (
    <div className={cn("surface p-4 sm:p-5 flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 pb-3">
        <div>
          <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </div>
  );
}
