import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, QueryState } from "@/components/dashboard/StateViews";
import { chartAxis, tooltipStyle } from "@/config/chartTheme";
import { useIndexExplanation } from "@/hooks/useAirfareData";
import { airlineByCode, routeLabel } from "@/services/data/mockData";
import type { IndexExplanation, IndexPeriod, RouteContribution } from "@/types";
import { formatDateTime, formatINR, formatIndex, formatNumber, formatPct, formatWindow } from "@/utils/format";
import { cn } from "@/lib/utils";

export interface ExplainTarget {
  period: IndexPeriod;
  periodStart: string;
  /** Route to focus first (e.g. the route of a shock alert). */
  routeId?: string;
}

export function ExplainChangeSheet({ target, onClose }: { target: ExplainTarget | null; onClose: () => void }) {
  const query = useIndexExplanation(target && { period: target.period, periodStart: target.periodStart });
  return (
    <Sheet open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="pr-6">
          <SheetTitle className="text-heading">Explain this change</SheetTitle>
          <SheetDescription>Breaks the index move into route contributions using the index's own formula and weights.</SheetDescription>
        </SheetHeader>
        <div className="mt-5">
          <QueryState query={query} height={360}>
            {(data) =>
              data ? (
                <Explanation data={data} initialRoute={target?.routeId} />
              ) : (
                <EmptyState title="Nothing to compare" description="This is the first period in the dataset, so there is no earlier index value to explain the change against." />
              )
            }
          </QueryState>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Explanation({ data, initialRoute }: { data: IndexExplanation; initialRoute?: string }) {
  const top = data.contributions[0]?.routeId;
  const [route, setRoute] = useState(initialRoute ?? top);
  useEffect(() => setRoute(initialRoute ?? top), [data, initialRoute, top]);

  const movers = useMemo(
    () => data.movers.filter((m) => m.routeId === route).sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0)),
    [data, route],
  );
  const chartData = data.contributions.map((c) => ({ ...c, label: routeLabel(c.routeId) }));
  const up = data.changePts >= 0;

  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-3 gap-2">
        <Stat label={`Previous · ${data.previous.periodLabel}`} value={formatIndex(data.previous.value)} />
        <Stat label={`Current · ${data.current.periodLabel}`} value={formatIndex(data.current.value)} />
        <Stat
          label="Change"
          value={`${up ? "+" : ""}${data.changePts.toFixed(2)} pts`}
          sub={formatPct(data.changePct)}
          tone={up ? "text-heading" : "text-success"}
        />
      </dl>

      <section aria-labelledby="contrib-h">
        <h3 id="contrib-h" className="text-xs font-semibold uppercase tracking-wide text-heading">
          Route contributions
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Weight × change in route relative. Click a bar or route to see its fares.</p>
        <div className="mt-2" style={{ height: Math.max(180, chartData.length * 34) }} role="img" aria-label="Index points contributed by each route">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" {...chartAxis} tickFormatter={(v: number) => v.toFixed(1)} />
              <YAxis type="category" dataKey="label" {...chartAxis} width={64} />
              <ReferenceLine x={0} stroke="var(--muted-foreground)" />
              <Tooltip
                {...tooltipStyle}
                cursor={{ fill: "var(--muted)" }}
                formatter={(v: number, _n, item) => {
                  const c = item.payload as RouteContribution;
                  return [`${v >= 0 ? "+" : ""}${v.toFixed(2)} pts · weight ${(c.weight * 100).toFixed(0)}% · route ${formatIndex(c.startRelative)} → ${formatIndex(c.endRelative)}`, "Contribution"];
                }}
              />
              <Bar dataKey="contributionPts" radius={2} maxBarSize={18} isAnimationActive={false} onClick={(d: { routeId?: string }) => d.routeId && setRoute(d.routeId)} className="cursor-pointer">
                {chartData.map((c) => (
                  <Cell
                    key={c.routeId}
                    fill={c.contributionPts >= 0 ? "var(--chart-1)" : "var(--success)"}
                    fillOpacity={c.routeId === route ? 1 : 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Focus route">
          {data.contributions.map((c) => (
            <button
              key={c.routeId}
              type="button"
              onClick={() => setRoute(c.routeId)}
              aria-pressed={c.routeId === route}
              className={cn(
                "rounded-sm border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                c.routeId === route ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {routeLabel(c.routeId)} <span className="num">{c.contributionPts >= 0 ? "+" : ""}{c.contributionPts.toFixed(2)}</span>
            </button>
          ))}
        </div>
        {Math.abs(data.residualPts) >= 0.01 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {data.residualPts.toFixed(2)} pts come from a change in which routes had data (re-weighting), not from any single route.
          </p>
        )}
      </section>

      <section aria-labelledby="movers-h">
        <h3 id="movers-h" className="text-xs font-semibold uppercase tracking-wide text-heading">
          {route ? routeLabel(route) : "Route"} — airline & advance-window fares
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Average fare per quote, previous vs current period, largest moves first.</p>
        {movers.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <caption className="sr-only">Fare changes by airline and advance window</caption>
              <thead>
                <tr className="border-b text-left uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-2 font-medium">Airline</th>
                  <th scope="col" className="py-1.5 pr-2 font-medium">Window</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Previous</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Current</th>
                  <th scope="col" className="py-1.5 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {movers.slice(0, 12).map((m) => (
                  <tr key={`${m.airlineCode}-${m.advanceDays}`} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">{airlineByCode(m.airlineCode)?.name ?? m.airlineCode}</td>
                    <td className="py-1.5 pr-2">{formatWindow(m.advanceDays)}</td>
                    <td className="num py-1.5 pr-2 text-right">{m.prevAvg === null ? "—" : formatINR(m.prevAvg)}</td>
                    <td className="num py-1.5 pr-2 text-right">{m.curAvg === null ? "—" : formatINR(m.curAvg)}</td>
                    <td className={cn("num py-1.5 text-right font-medium", (m.changePct ?? 0) > 0 ? "text-heading" : "text-success")}>{formatPct(m.changePct, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movers.length > 12 && <p className="mt-1 text-[11px] text-muted-foreground">Showing 12 of {movers.length} quotes.</p>}
          </div>
        ) : (
          <EmptyState title="No comparable fares for this route" />
        )}
      </section>

      <section className="space-y-1.5 rounded-md border bg-background p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Sample:</span> {formatNumber(data.previous.observationCount)} fares (previous) · {formatNumber(data.current.observationCount)} fares (current) ·
          latest capture {data.latestCollectionAt ? formatDateTime(data.latestCollectionAt) : "—"}.
        </p>
        <p>
          <span className="font-medium text-foreground">How it's calculated:</span> each route's relative (geometric mean of fare ÷ base fare × 100) is weighted by its traffic share. A
          route's contribution = its weight × the change in its relative; contributions add up to the index change. Method {data.methodVersion}.
        </p>
        <p>
          Weights are illustrative DEMO values, not DGCA figures. Contributions show <em>where</em> the index moved, not <em>why</em> — they do not establish a cause.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <dt className="truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </dt>
      <dd className={cn("num mt-1 text-base font-semibold", tone)}>{value}</dd>
      {sub && <dd className={cn("num text-xs", tone)}>{sub}</dd>}
    </div>
  );
}
