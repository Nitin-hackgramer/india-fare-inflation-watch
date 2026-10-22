import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpToLine, Gauge, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Panel } from "@/components/dashboard/Panel";
import { QueryState } from "@/components/dashboard/StateViews";
import { IndexTrendChart } from "@/components/charts/IndexTrendChart";
import { MultiLineChart } from "@/components/charts/MultiLineChart";
import { PeriodToggle } from "@/components/filters/PeriodToggle";
import { DateRangeInputs } from "@/components/filters/DateRangeInputs";
import { LabeledSelect } from "@/components/filters/LabeledSelect";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ExportCsvButton } from "@/components/tables/ExportCsvButton";
import { ExplainChangeSheet, type ExplainTarget } from "@/components/shock/ExplainChangeSheet";
import { WhatIfSimulator } from "@/components/shock/WhatIfSimulator";
import { Button } from "@/components/ui/button";
import { AIRLINE_COLORS } from "@/config/chartTheme";
import { useAirlineSegments, useIndexHistory, useIndexSnapshot, useRouteContributions } from "@/hooks/useAirfareData";
import { usePreferences } from "@/hooks/usePreferences";
import { AIRLINES, airlineByCode, routeLabel } from "@/services/data/mockData";
import { rangeToDates } from "@/services/data/mockRepository";
import type { AirlineSegmentSeries, DateRange, IndexObservation, IndexPeriod, RouteContribution } from "@/types";
import type { CsvColumn } from "@/utils/csv";
import { percentChange } from "@/utils/indexCalculation";
import { formatDate, formatIndex, formatNumber, formatPct } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/airfare-index")({
  head: () => ({
    meta: [
      { title: "Airfare Index — Airfare Index India" },
      { name: "description", content: "Daily, weekly and monthly airfare price index with route and airline breakdowns (demo data)." },
    ],
  }),
  component: AirfareIndexPage,
});

const historyColumns: Column<IndexObservation>[] = [
  { key: "period", header: "Period", cell: (r) => r.periodLabel, sortValue: (r) => r.periodStart },
  { key: "start", header: "Period start", cell: (r) => formatDate(r.periodStart), sortValue: (r) => r.periodStart },
  { key: "value", header: "Index", cell: (r) => formatIndex(r.value), sortValue: (r) => r.value, align: "right" },
  {
    key: "change",
    header: "Change vs prior",
    cell: (r) => <span className={cn(r.changePct !== null && r.changePct > 0 ? "text-heading" : "text-success")}>{formatPct(r.changePct)}</span>,
    sortValue: (r) => r.changePct ?? 0,
    align: "right",
  },
  { key: "count", header: "Observations", cell: (r) => formatNumber(r.observationCount), sortValue: (r) => r.observationCount, align: "right" },
];

const historyCsv: CsvColumn<IndexObservation>[] = [
  { header: "period_start", value: (r) => r.periodStart },
  { header: "period_label", value: (r) => r.periodLabel },
  { header: "index_value", value: (r) => r.value.toFixed(4) },
  { header: "change_pct", value: (r) => r.changePct?.toFixed(4) },
  { header: "observation_count", value: (r) => r.observationCount },
  { header: "data_status", value: () => "DEMO DATA" },
];

/** Pivot per-airline series into chart rows: { periodStart, 6E: 101.2, AI: 99.8, … }. */
function pivotSegments(segments: AirlineSegmentSeries[]) {
  const rows = new Map<string, Record<string, string | number>>();
  for (const seg of segments)
    for (const p of seg.series) {
      const row = rows.get(p.periodStart) ?? { periodStart: p.periodStart, periodLabel: p.periodLabel };
      row[seg.airlineCode] = Number(p.value.toFixed(2));
      rows.set(p.periodStart, row);
    }
  return [...rows.values()].sort((a, b) => String(a.periodStart).localeCompare(String(b.periodStart)));
}

function AirfareIndexPage() {
  const { prefs, range } = usePreferences();
  const [period, setPeriod] = useState<IndexPeriod>(prefs.indexView);
  const [dates, setDates] = useState<DateRange>(() => rangeToDates(range));
  const [airline, setAirline] = useState("all");
  const [explain, setExplain] = useState<ExplainTarget | null>(null);
  useEffect(() => setDates(rangeToDates(range)), [range]);

  const history = useIndexHistory(period, dates, airline === "all" ? undefined : airline);
  const snapshot = useIndexSnapshot(period);
  const contributions = useRouteContributions(dates);
  const segments = useAirlineSegments(period, dates);

  const rows = history.data ?? [];
  const latest = rows[rows.length - 1];
  const values = rows.map((r) => r.value);
  const segmentLabel = airline === "all" ? "All airlines" : airlineByCode(airline)?.name;

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Aggregation</span>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
        <DateRangeInputs idPrefix="idx" value={dates} onChange={setDates} />
        <LabeledSelect
          id="idx-airline"
          label="Segment"
          className="w-[180px]"
          value={airline}
          onChange={setAirline}
          options={[{ value: "all", label: "All airlines" }, ...AIRLINES.map((a) => ({ value: a.code, label: a.name }))]}
        />
        <div className="ml-auto">
          <ExportCsvButton rows={rows} columns={historyCsv} filename={`airfare-index-${period}-${dates.from}-to-${dates.to}.csv`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label={`Latest ${period} index`} icon={Gauge} loading={history.isPending} value={latest && formatIndex(latest.value)} hint={latest?.periodLabel} highlight />
        <KpiCard
          label="Change over range"
          icon={TrendingUp}
          loading={history.isPending}
          trend={rows.length > 1 ? percentChange(latest.value, rows[0].value) : null}
          value={formatPct(rows.length > 1 ? percentChange(latest.value, rows[0].value) : null)}
          hint={rows.length ? `${rows[0].periodLabel} → ${latest.periodLabel}` : undefined}
        />
        <KpiCard label="Range high" icon={ArrowUpToLine} loading={history.isPending} value={values.length ? formatIndex(Math.max(...values)) : "—"} hint={segmentLabel} />
        <KpiCard label="Range low" icon={ArrowDownToLine} loading={history.isPending} value={values.length ? formatIndex(Math.min(...values)) : "—"} hint={segmentLabel} />
      </div>

      <Panel
        title={`Index trend — ${segmentLabel}`}
        description={
          snapshot.data
            ? `Base period ${formatDate(snapshot.data.basePeriod.from)} – ${formatDate(snapshot.data.basePeriod.to)} = 100 · Method ${snapshot.data.methodVersion}`
            : "Baseline-normalised index (base period = 100)."
        }
      >
        <QueryState query={history} isEmpty={(d) => !d.length} height={320}>
          {(data) => (
            <IndexTrendChart
              data={data}
              height={320}
              onPointClick={airline === "all" ? (p) => setExplain({ period, periodStart: p.periodStart }) : undefined}
            />
          )}
        </QueryState>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{airline === "all" ? "Click any point to explain that period's change." : "Explanations cover the all-airlines index — switch Segment to All airlines."}</span>
          {airline === "all" && latest && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setExplain({ period, periodStart: latest.periodStart })}>
              Explain latest change
            </Button>
          )}
        </div>
      </Panel>

      <WhatIfSimulator period={period} range={dates} />

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Airline segment comparison" description="Index computed separately for each airline's fares." className="lg:col-span-3">
          <QueryState query={segments} isEmpty={(d) => d.every((s) => !s.series.length)} height={300}>
            {(d) => (
              <MultiLineChart
                data={pivotSegments(d)}
                xKey="periodLabel"
                series={AIRLINES.map((a) => ({ key: a.code, label: a.name, color: AIRLINE_COLORS[a.code] }))}
                format={formatIndex}
                yFormat={(v) => v.toFixed(0)}
                ariaLabel="Index by airline segment"
              />
            )}
          </QueryState>
        </Panel>
        <Panel title="Route contribution" description="Index points each route added or removed between range start and end." className="lg:col-span-2">
          <QueryState query={contributions} isEmpty={(d) => !d.length} height={300}>
            {(d) => <ContributionList items={d} />}
          </QueryState>
        </Panel>
      </div>

      <Panel title="Historical index values" description={`${segmentLabel} · ${period} aggregation · ${formatDate(dates.from)} – ${formatDate(dates.to)}`}>
        <QueryState query={history} isEmpty={(d) => !d.length}>
          {(data) => (
            <DataTable rows={data} columns={historyColumns} getRowId={(r) => r.periodStart} caption="Historical index values" initialSort={{ key: "start", dir: "desc" }} />
          )}
        </QueryState>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Illustrative prototype index on DEMO DATA — not an official CPI or MoSPI figure.{" "}
          <Link to="/methodology" className="text-heading underline-offset-2 hover:underline">
            Read the methodology
          </Link>
          .
        </p>
      </Panel>

      <ExplainChangeSheet target={explain} onClose={() => setExplain(null)} />
    </div>
  );
}

function ContributionList({ items }: { items: RouteContribution[] }) {
  const sorted = [...items].sort((a, b) => b.contributionPts - a.contributionPts);
  const maxAbs = Math.max(...sorted.map((c) => Math.abs(c.contributionPts)), 0.01);
  const total = sorted.reduce((s, c) => s + c.contributionPts, 0);
  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {sorted.map((c) => {
          const pct = (Math.abs(c.contributionPts) / maxAbs) * 50;
          const up = c.contributionPts >= 0;
          return (
            <li key={c.routeId} className="grid grid-cols-[64px_1fr_64px] items-center gap-2 text-xs">
              <span className="font-medium">{routeLabel(c.routeId)}</span>
              <div className="relative h-3 rounded-sm bg-muted" title={`Weight ${(c.weight * 100).toFixed(0)}% · route change ${formatPct(c.changePct)}`}>
                <span className="absolute inset-y-0 left-1/2 w-px bg-border" aria-hidden />
                <span
                  className={cn("absolute inset-y-0 rounded-sm", up ? "bg-primary" : "bg-success")}
                  style={up ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }}
                />
              </div>
              <span className="num text-right">
                {up ? "+" : ""}
                {c.contributionPts.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t pt-2 text-xs text-muted-foreground">
        Net change: <span className="num font-medium text-foreground">{total >= 0 ? "+" : ""}{total.toFixed(2)} pts</span> (weighted by route traffic share)
      </p>
    </div>
  );
}
