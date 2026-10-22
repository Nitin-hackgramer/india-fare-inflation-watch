import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpToLine, Database, IndianRupee, RotateCcw } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState, QueryState } from "@/components/dashboard/StateViews";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { DateRangeInputs } from "@/components/filters/DateRangeInputs";
import { LabeledSelect } from "@/components/filters/LabeledSelect";
import { DataTable } from "@/components/tables/DataTable";
import { ExportCsvButton } from "@/components/tables/ExportCsvButton";
import { observationColumns, observationCsv } from "@/components/tables/observationColumns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AIRLINE_COLORS } from "@/config/chartTheme";
import { useFares } from "@/hooks/useAirfareData";
import { usePreferences } from "@/hooks/usePreferences";
import { ADVANCE_WINDOWS, AIRLINES, CITIES, DEMO_END_DATE, DEMO_START_DATE, ROUTES, airlineByCode, routeLabel } from "@/services/data/mockData";
import { rangeToDates } from "@/services/data/mockRepository";
import type { AdvanceWindow, DateRange, FareFilter, FareObservation } from "@/types";
import { addDays } from "@/utils/date";
import { averageBy, dailyAverageByAirline, fareMatrix, fareStats, fareStatsBy } from "@/utils/fareFilters";
import { formatDate, formatINR, formatNumber, formatShortDate, formatWindow } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/route-explorer")({
  head: () => ({
    meta: [
      { title: "Route Explorer — Airfare Index India" },
      { name: "description", content: "Compare airline fares by city pair and advance-purchase window (demo data)." },
    ],
  }),
  component: RouteExplorer,
});

interface UiFilters {
  origin: string; // "all" = any
  destination: string;
  airline: string;
  window: string;
  travelDate: string; // "" = any
  dates: DateRange;
}

const ALL = "all";
const cityOptions = (anyLabel: string) => [{ value: ALL, label: anyLabel }, ...Object.values(CITIES).map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))];

const defaults = (dates: DateRange): UiFilters => ({ origin: "DEL", destination: "BOM", airline: ALL, window: ALL, travelDate: "", dates });

/** UI state → service filter. "all" / "" mean "no constraint". */
function toFareFilter(f: UiFilters): FareFilter {
  return {
    origin: f.origin === ALL ? undefined : f.origin,
    destination: f.destination === ALL ? undefined : f.destination,
    airlineCode: f.airline === ALL ? undefined : f.airline,
    advanceDays: f.window === ALL ? undefined : (Number(f.window) as AdvanceWindow),
    travelDate: f.travelDate || undefined,
    from: f.dates.from,
    to: f.dates.to,
  };
}

function RouteExplorer() {
  const { range } = usePreferences();
  const [f, setF] = useState<UiFilters>(() => defaults(rangeToDates(range)));
  useEffect(() => setF((p) => ({ ...p, dates: rangeToDates(range) })), [range]);
  const set = <K extends keyof UiFilters>(k: K, v: UiFilters[K]) => setF((p) => ({ ...p, [k]: v }));

  const filter = useMemo(() => toFareFilter(f), [f]);
  const fares = useFares(filter);
  const routeId = ROUTES.find((r) => r.origin.code === f.origin && r.destination.code === f.destination)?.id ?? "custom";
  const reset = () => setF(defaults(rangeToDates(range)));

  return (
    <div className="page-enter space-y-5">
      <section aria-label="Filters" className="rounded-md border bg-card p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <LabeledSelect
            id="re-route"
            label="City pair"
            value={routeId}
            onChange={(v) => {
              const r = ROUTES.find((x) => x.id === v);
              if (r) setF((p) => ({ ...p, origin: r.origin.code, destination: r.destination.code }));
            }}
            options={[...ROUTES.map((r) => ({ value: r.id, label: routeLabel(r.id) })), ...(routeId === "custom" ? [{ value: "custom", label: "Custom" }] : [])]}
          />
          <LabeledSelect id="re-origin" label="Origin" value={f.origin} onChange={(v) => set("origin", v)} options={cityOptions("Any origin")} />
          <LabeledSelect id="re-dest" label="Destination" value={f.destination} onChange={(v) => set("destination", v)} options={cityOptions("Any destination")} />
          <LabeledSelect
            id="re-airline"
            label="Airline"
            value={f.airline}
            onChange={(v) => set("airline", v)}
            options={[{ value: ALL, label: "All airlines" }, ...AIRLINES.map((a) => ({ value: a.code, label: a.name }))]}
          />
          <div className="col-span-2 grid gap-1">
            <Label htmlFor="re-travel" className="text-xs text-muted-foreground">
              Travel date (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="re-travel"
                type="date"
                className="h-8 text-xs"
                min={addDays(DEMO_START_DATE, 1)}
                max={addDays(DEMO_END_DATE, 45)}
                value={f.travelDate}
                onChange={(e) => set("travelDate", e.target.value)}
              />
              {f.travelDate && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => set("travelDate", "")}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
          <div className="grid gap-1">
            <span id="re-window-label" className="text-xs text-muted-foreground">
              Advance-purchase window
            </span>
            <ToggleGroup type="single" size="sm" variant="outline" value={f.window} onValueChange={(v) => v && set("window", v)} aria-labelledby="re-window-label">
              {[ALL, ...ADVANCE_WINDOWS.map(String)].map((w) => (
                <ToggleGroupItem key={w} value={w} className="px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {w === ALL ? "All" : formatWindow(Number(w) as AdvanceWindow)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <DateRangeInputs idPrefix="re" value={f.dates} onChange={(d) => set("dates", d)} />
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={reset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Reset filters
            </Button>
            <ExportCsvButton rows={fares.data ?? []} columns={observationCsv} filename={`route-fares-${f.origin}-${f.destination}-${f.dates.from}-to-${f.dates.to}.csv`} />
          </div>
        </div>
      </section>

      <QueryState
        query={fares}
        height={400}
        isEmpty={(d) => !d.length}
        empty={
          <div className="rounded-md border bg-card">
            <EmptyState
              title="No fares match these filters"
              description="This city pair may not be in the route basket (routes are one-way, e.g. MAA–DEL not DEL–MAA), or the travel date falls outside the selected collection range."
              action={
                <Button size="sm" variant="outline" onClick={reset}>
                  Reset filters
                </Button>
              }
            />
          </div>
        }
      >
        {(rows) => <Results rows={rows} />}
      </QueryState>
    </div>
  );
}

function Results({ rows }: { rows: FareObservation[] }) {
  const stats = fareStats(rows)!;
  const byAirline = useMemo(() => fareStatsBy(rows, (o) => o.airlineCode), [rows]);
  const avgByAirline = useMemo(() => averageBy(rows, (o) => o.airlineCode, (k) => airlineByCode(k)?.name ?? k).sort((a, b) => a.value - b.value), [rows]);
  const matrix = useMemo(() => fareMatrix(rows), [rows]);
  const trend = useMemo(() => dailyAverageByAirline(rows), [rows]);
  const airlines = AIRLINES.filter((a) => byAirline.has(a.code));
  const windows = ADVANCE_WINDOWS.filter((w) => airlines.some((a) => matrix[a.code]?.[w] !== undefined));
  const cheapestAt = (w: number) => Math.min(...airlines.map((a) => matrix[a.code]?.[w] ?? Infinity));
  const minFare = rows.find((o) => o.fare === stats.min)!;
  const maxFare = rows.find((o) => o.fare === stats.max)!;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Lowest fare" icon={ArrowDownToLine} value={formatINR(stats.min)} hint={`${airlineByCode(minFare.airlineCode)?.name} · ${formatWindow(minFare.advanceDays)} · ${formatShortDate(minFare.travelDate)}`} />
        <KpiCard label="Average fare" icon={IndianRupee} value={formatINR(stats.avg)} hint="Mean of matching quotes" highlight />
        <KpiCard label="Highest fare" icon={ArrowUpToLine} value={formatINR(stats.max)} hint={`${airlineByCode(maxFare.airlineCode)?.name} · ${formatWindow(maxFare.advanceDays)} · ${formatShortDate(maxFare.travelDate)}`} />
        <KpiCard label="Observations" icon={Database} value={formatNumber(stats.count)} hint={`${airlines.length} airline${airlines.length === 1 ? "" : "s"}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Airline fare comparison" description="Average fare per airline, cheapest first." className="lg:col-span-2">
          <CategoryBarChart data={avgByAirline} orientation="horizontal" format={formatINR} colorFor={(k) => AIRLINE_COLORS[k]} height={Math.max(160, avgByAirline.length * 44)} ariaLabel="Average fare by airline" />
        </Panel>
        <Panel title="Fare by airline and advance window" description="Average fare (₹). Bold orange = cheapest airline for that window." className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="sr-only">Average fare by airline and advance-purchase window</caption>
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-2 py-2 text-left font-medium">Airline</th>
                  {windows.map((w) => (
                    <th key={w} scope="col" className="px-2 py-2 text-right font-medium">
                      {formatWindow(w)}
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-right font-medium">Low – High</th>
                </tr>
              </thead>
              <tbody>
                {airlines.map((a) => {
                  const s = byAirline.get(a.code)!;
                  return (
                    <tr key={a.code} className="border-b last:border-0">
                      <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-medium">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: AIRLINE_COLORS[a.code] }} aria-hidden />
                        {a.name}
                      </th>
                      {windows.map((w) => {
                        const v = matrix[a.code]?.[w];
                        const best = v !== undefined && v === cheapestAt(w) && airlines.length > 1;
                        return (
                          <td key={w} className={cn("num px-2 py-2 text-right", best && "font-semibold text-heading")}>
                            {v === undefined ? "—" : formatINR(v)}
                          </td>
                        );
                      })}
                      <td className="num whitespace-nowrap px-2 py-2 text-right text-xs text-muted-foreground">
                        {formatINR(s.min)} – {formatINR(s.max)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Historical fare trend" description="Daily average observed fare per airline for the current filters.">
        {trend.length > 1 ? (
          <MultiLineChart
            data={trend}
            xKey="date"
            xFormat={formatShortDate}
            series={airlines.map((a) => ({ key: a.code, label: a.name, color: AIRLINE_COLORS[a.code] }))}
            format={formatINR}
            yFormat={(v) => `${Math.round(v / 1000)}k`}
            ariaLabel="Daily average fare by airline"
          />
        ) : (
          <EmptyState title="Not enough dates for a trend" description="Widen the date range or clear the travel date to see a trend." />
        )}
      </Panel>

      <Panel title="Fare observations" description={`${formatNumber(rows.length)} quotes · collected ${formatDate(rows[0].observedDate)} onwards`}>
        <DataTable rows={rows} columns={observationColumns} getRowId={(o) => o.id} caption="Fare observations for current filters" initialSort={{ key: "collected", dir: "desc" }} />
      </Panel>
    </div>
  );
}
