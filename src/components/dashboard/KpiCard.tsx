import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiCardProps {
  label: string;
  value?: string;
  hint?: string;
  icon: LucideIcon;
  /** When set, the value is rendered as a directional change. */
  trend?: number | null;
  loading?: boolean;
  highlight?: boolean;
}

export function KpiCard({ label, value, hint, icon: Icon, trend, loading, highlight }: KpiCardProps) {
  const TrendIcon = trend === undefined || trend === null || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn("rounded-md border bg-card p-4", highlight && "border-l-2 border-l-primary")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <div className="mt-2 flex items-baseline gap-1.5">
          {trend !== undefined && (
            <TrendIcon
              aria-hidden
              className={cn("h-4 w-4 self-center", trend && trend > 0 ? "text-primary" : "text-success")}
            />
          )}
          <span className="num text-2xl font-semibold text-foreground">{value}</span>
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
