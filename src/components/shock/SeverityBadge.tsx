import { TrendingDown, TrendingUp } from "lucide-react";
import type { FareShock, ShockSeverity } from "@/types";
import { cn } from "@/lib/utils";

const STYLE: Record<ShockSeverity, string> = {
  moderate: "border-warning/50 bg-warning/15 text-warning-foreground",
  high: "border-primary/40 bg-primary/10 text-heading",
  severe: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function SeverityBadge({ severity }: { severity: ShockSeverity }) {
  return <span className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold capitalize", STYLE[severity])}>{severity}</span>;
}

export function DirectionIcon({ direction, className }: { direction: FareShock["direction"]; className?: string }) {
  const Icon = direction === "increase" ? TrendingUp : TrendingDown;
  return <Icon className={cn("h-3.5 w-3.5", direction === "increase" ? "text-heading" : "text-success", className)} aria-label={direction === "increase" ? "Fare increase" : "Fare decrease"} />;
}

/** Leaf-coloured tag for anything hypothetical or simulated. */
export function HypotheticalTag({ children = "Hypothetical · demo" }: { children?: string }) {
  return <span className="inline-flex items-center rounded-sm border border-leaf-foreground/20 bg-leaf px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-leaf-foreground">{children}</span>;
}
