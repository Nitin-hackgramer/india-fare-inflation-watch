import { Button } from "@/components/ui/button";
import { airlineByCode, routeLabel } from "@/services/data/mockData";
import type { FareShock } from "@/types";
import { formatDate, formatINR, formatPct } from "@/utils/format";
import { DirectionIcon, SeverityBadge } from "./SeverityBadge";

export function ShockAlertList({ shocks, onExplain }: { shocks: FareShock[]; onExplain: (s: FareShock) => void }) {
  return (
    <ul className="divide-y">
      {shocks.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
          <SeverityBadge severity={s.severity} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <DirectionIcon direction={s.direction} />
              {routeLabel(s.routeId)} · {airlineByCode(s.airlineCode)?.name ?? s.airlineCode}
              <span className={`num ${s.direction === "increase" ? "text-heading" : "text-success"}`}>{formatPct(s.changePct, 1)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(s.observedDate)} · {formatINR(s.baselineAvgFare)} → {formatINR(s.currentAvgFare)} · n = {s.sampleSize}
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onExplain(s)}>
            Explain this change
          </Button>
        </li>
      ))}
    </ul>
  );
}
