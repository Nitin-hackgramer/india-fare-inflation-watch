import { appConfig } from "@/config/appConfig";
import { cn } from "@/lib/utils";

export function DemoBadge({ className }: { className?: string }) {
  const demo = appConfig.useMockData;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        demo ? "border-warning/50 bg-warning/15 text-warning-foreground" : "border-success/40 bg-success/10 text-success",
        className,
      )}
      title={demo ? "Simulated data — not live collection" : "Connected to configured backend"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", demo ? "bg-warning" : "bg-success")} aria-hidden />
      {demo ? "Demo data" : "Live API"}
    </span>
  );
}
