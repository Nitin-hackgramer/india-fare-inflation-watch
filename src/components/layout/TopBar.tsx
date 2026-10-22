import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/dashboard/DemoBadge";
import { usePreferences } from "@/hooks/usePreferences";
import { useDashboardSummary } from "@/hooks/useAirfareData";
import { formatDateTime } from "@/utils/format";
import type { ReportingRange } from "@/types";
import { NAV_ITEMS } from "./AppShell";

export const RANGE_OPTIONS: { value: ReportingRange; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 180 days" },
];

export function TopBar({ onOpenMenu, menuButton }: { onOpenMenu: () => void; menuButton: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = NAV_ITEMS.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)))?.label ?? "Airfare Index India";
  const { range, setRange } = usePreferences();
  const summary = useDashboardSummary(range);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        {menuButton}
      </Button>
      <h1 className="truncate text-base font-semibold text-heading md:text-lg">{title}</h1>
      <div className="ml-auto flex items-center gap-2 md:gap-4">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Last updated {summary.data ? formatDateTime(summary.data.lastUpdated) : "…"}
        </span>
        <Select value={range} onValueChange={(v) => setRange(v as ReportingRange)}>
          <SelectTrigger className="h-8 w-[136px] text-xs" aria-label="Reporting period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DemoBadge className="hidden sm:inline-flex" />
      </div>
    </header>
  );
}
