import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { QueryState } from "@/components/dashboard/StateViews";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { LabeledSelect } from "@/components/filters/LabeledSelect";
import { HypotheticalTag } from "@/components/shock/SeverityBadge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useRouteRelatives } from "@/hooks/useAirfareData";
import { ROUTES, routeLabel } from "@/services/data/mockData";
import type { DateRange, IndexPeriod, PeriodRelatives } from "@/types";
import { simulateIndex } from "@/utils/indexCalculation";
import { formatIndex, formatPct } from "@/utils/format";
import { cn } from "@/lib/utils";

const defaultWeight = (id: string) => Math.round((ROUTES.find((r) => r.id === id)?.trafficWeight ?? 0) * 100);

export function WhatIfSimulator({ period, range }: { period: IndexPeriod; range: DateRange }) {
  const query = useRouteRelatives(period, range);
  return (
    <Panel
      title="Simulate fare change"
      description="Hypothetical scenario: shift one route's fares and recompute the index with the same weighting. Recorded data is never changed."
      actions={<HypotheticalTag />}
    >
      <QueryState query={query} isEmpty={(d) => !d.length} height={320}>
        {(points) => <Simulator points={points} />}
      </QueryState>
    </Panel>
  );
}

function Simulator({ points }: { points: PeriodRelatives[] }) {
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const [farePct, setFarePct] = useState(10);
  const [weightPct, setWeightPct] = useState(defaultWeight(ROUTES[0].id));

  const sim = useMemo(() => simulateIndex(points, ROUTES, { routeId, farePct, weight: weightPct / 100 }), [points, routeId, farePct, weightPct]);
  const last = sim[sim.length - 1];
  const diff = last.simulated - last.baseline;
  const others = ROUTES.filter((r) => r.id !== routeId).reduce((s, r) => s + r.trafficWeight, 0);
  const share = weightPct / 100 / (weightPct / 100 + others);
  const reset = () => {
    setFarePct(0);
    setWeightPct(defaultWeight(routeId));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="space-y-5">
        <LabeledSelect
          id="sim-route"
          label="Route"
          value={routeId}
          onChange={(v) => {
            setRouteId(v);
            setWeightPct(defaultWeight(v));
          }}
          options={ROUTES.map((r) => ({ value: r.id, label: routeLabel(r.id) }))}
        />
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between text-xs">
            <span id="sim-fare-label" className="text-muted-foreground">
              Fare change on route
            </span>
            <span className="num font-semibold">{formatPct(farePct, 0)}</span>
          </div>
          <Slider aria-labelledby="sim-fare-label" min={-50} max={50} step={1} value={[farePct]} onValueChange={([v]) => setFarePct(v)} />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>−50%</span>
            <span>0</span>
            <span>+50%</span>
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between text-xs">
            <span id="sim-weight-label" className="text-muted-foreground">
              Route weight (illustrative)
            </span>
            <span className="num font-semibold">{weightPct}%</span>
          </div>
          <Slider aria-labelledby="sim-weight-label" min={0} max={60} step={1} value={[weightPct]} onValueChange={([v]) => setWeightPct(v)} />
          <p className="text-[11px] text-muted-foreground">
            Effective share after re-normalising: <span className="num">{(share * 100).toFixed(1)}%</span>. Demo default {defaultWeight(routeId)}%.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={reset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Reset scenario
        </Button>
      </div>

      <div className="min-w-0 space-y-4">
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-live="polite">
          <Stat label={`Recorded · ${last.periodLabel}`} value={formatIndex(last.baseline)} />
          <Stat label="Simulated index" value={formatIndex(last.simulated)} leaf />
          <Stat label="Difference" value={`${diff >= 0 ? "+" : ""}${diff.toFixed(2)} pts`} leaf />
          <Stat label="Difference %" value={formatPct((diff / last.baseline) * 100)} leaf />
        </dl>
        <p className="text-xs text-muted-foreground">
          {routeLabel(routeId)} route relative:{" "}
          <span className="num text-foreground">
            {last.routeBaseline === null ? "—" : formatIndex(last.routeBaseline)} → {last.routeSimulated === null ? "—" : formatIndex(last.routeSimulated)}
          </span>
          . Scaling every fare on a route by k scales its geometric-mean relative by exactly k.
        </p>
        <MultiLineChart
          data={sim.map((p) => ({ periodLabel: p.periodLabel, recorded: Number(p.baseline.toFixed(2)), simulated: Number(p.simulated.toFixed(2)) }))}
          xKey="periodLabel"
          series={[
            { key: "recorded", label: "Recorded index", color: "var(--chart-2)" },
            { key: "simulated", label: "Simulated (hypothetical)", color: "var(--chart-1)" },
          ]}
          format={formatIndex}
          yFormat={(v) => v.toFixed(0)}
          height={260}
          ariaLabel="Recorded versus simulated index"
        />
      </div>
    </div>
  );
}

function Stat({ label, value, leaf }: { label: string; value: string; leaf?: boolean }) {
  return (
    <div className={cn("rounded-md border p-2.5", leaf ? "border-leaf-foreground/15 bg-leaf text-leaf-foreground" : "bg-card")}>
      <dt className={cn("truncate text-[11px]", leaf ? "text-leaf-foreground/80" : "text-muted-foreground")} title={label}>
        {label}
      </dt>
      <dd className="num mt-1 text-base font-semibold">{value}</dd>
    </div>
  );
}
