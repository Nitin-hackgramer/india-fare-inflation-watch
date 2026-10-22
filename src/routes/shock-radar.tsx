import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertOctagon, Info, TrendingDown, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Panel } from "@/components/dashboard/Panel";
import { QueryState } from "@/components/dashboard/StateViews";
import { IndexTrendChart } from "@/components/charts/IndexTrendChart";
import { LabeledSelect } from "@/components/filters/LabeledSelect";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ExportCsvButton } from "@/components/tables/ExportCsvButton";
import { ExplainChangeSheet, type ExplainTarget } from "@/components/shock/ExplainChangeSheet";
import { DirectionIcon, SeverityBadge } from "@/components/shock/SeverityBadge";
import { Button } from "@/components/ui/button";
import { useIndexHistory, useShocks } from "@/hooks/useAirfareData";
import { usePreferences } from "@/hooks/usePreferences";
import { AIRLINES, ROUTES, airlineByCode, routeLabel } from "@/services/data/mockData";
import { rangeToDates } from "@/services/data/mockRepository";
import type { FareShock } from "@/types";
import type { CsvColumn } from "@/utils/csv";
import { SHOCK_RULES } from "@/utils/shockDetection";
import { formatDateTime, formatINR, formatNumber, formatPct, formatWindow } from "@/utils/format";

export const Route = createFileRoute("/shock-radar")({
  head: () => ({
    meta: [
      { title: "Shock Radar — Airfare Index India" },
      { name: "description", content: "Statistically unusual airfare increases and decreases, with route-level explanations (demo data)." },
    ],
  }),
  component: ShockRadar,
});

const SEVERITY_RANK = { moderate: 1, high: 2, severe: 3 } as const;

const csv: CsvColumn<FareShock>[] = [
  { header: "observed_date", value: (s) => s.observedDate },
  { header: "collected_at", value: (s) => s.collectedAt },
  { header: "route", value: (s) => s.routeId },
  { header: "airline", value: (s) => airlineByCode(s.airlineCode)?.name ?? s.airlineCode },
  { header: "direction", value: (s) => s.direction },
  { header: "severity", value: (s) => s.severity },
  { header: "change_pct_vs_rolling_median", value: (s) => s.changePct.toFixed(2) },
  { header: "robust_z", value: (s) => s.robustZ.toFixed(2) },
  { header: "baseline_avg_fare_inr", value: (s) => Math.round(s.baselineAvgFare) },
  { header: "current_avg_fare_inr", value: (s) => Math.round(s.currentAvgFare) },
  { header: "windows_flagged", value: (s) => s.windows.map(formatWindow).join(" ") },
  { header: "windows_tested", value: (s) => s.cellsObserved },
  { header: "sample_size", value: (s) => s.sampleSize },
  { header: "status", value: () => "DETECTED (cause not confirmed) · DEMO DATA" },
];

function ShockRadar() {
  const { range } = usePreferences();
  const dates = rangeToDates(range);
  const scan = useShocks(dates);
  const history = useIndexHistory("daily", dates);
  const [explain, setExplain] = useState<ExplainTarget | null>(null);
  const [severity, setSeverity] = useState("all");
  const [direction, setDirection] = useState("all");
  const [route, setRoute] = useState("all");

  const all = scan.data?.shocks ?? [];
  const rows = useMemo(
    () =>
      all.filter(
        (s) =>
          (severity === "all" || SEVERITY_RANK[s.severity] >= SEVERITY_RANK[severity as FareShock["severity"]]) &&
          (direction === "all" || s.direction === direction) &&
          (route === "all" || s.routeId === route),
      ),
    [all, severity, direction, route],
  );
  const explainShock = (s: FareShock) => setExplain({ period: "daily", periodStart: s.observedDate, routeId: s.routeId });

  const columns: Column<FareShock>[] = [
    { key: "severity", header: "Severity", cell: (s) => <SeverityBadge severity={s.severity} />, sortValue: (s) => Math.abs(s.robustZ) },
    { key: "time", header: "Observed", cell: (s) => <span className="text-muted-foreground">{formatDateTime(s.collectedAt)}</span>, sortValue: (s) => s.collectedAt },
    { key: "route", header: "Route", cell: (s) => <span className="font-medium">{routeLabel(s.routeId)}</span>, sortValue: (s) => s.routeId },
    { key: "airline", header: "Airline", cell: (s) => airlineByCode(s.airlineCode)?.name ?? s.airlineCode, sortValue: (s) => s.airlineCode },
    {
      key: "change",
      header: "Change",
      cell: (s) => (
        <span className="inline-flex items-center gap-1">
          <DirectionIcon direction={s.direction} />
          {formatPct(s.changePct, 1)}
        </span>
      ),
      sortValue: (s) => s.changePct,
      align: "right",
    },
    { key: "fares", header: "Median → now", cell: (s) => `${formatINR(s.baselineAvgFare)} → ${formatINR(s.currentAvgFare)}`, sortValue: (s) => s.currentAvgFare, align: "right" },
    { key: "z", header: "Robust z", cell: (s) => s.robustZ.toFixed(1), sortValue: (s) => Math.abs(s.robustZ), align: "right" },
    { key: "windows", header: "Windows", cell: (s) => <span title={s.windows.map(formatWindow).join(", ")}>{s.windows.length} / {s.cellsObserved}</span>, sortValue: (s) => s.windows.length, align: "right" },
    { key: "n", header: "Sample", cell: (s) => formatNumber(s.sampleSize), sortValue: (s) => s.sampleSize, align: "right" },
    {
      key: "explain",
      header: "",
      cell: (s) => (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => explainShock(s)}>
          Explain
        </Button>
      ),
    },
  ];

  return (
    <div className="page-enter space-y-5">
      <div role="note" className="flex gap-2.5 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs text-warning-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <strong>Detected, not confirmed.</strong> An alert means a fare was statistically unusual against its own recent history. It does not tell you why — demand, capacity,
          schedule changes or data issues all look the same here. All alerts are on DEMO DATA, including seeded example shocks.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Alerts in period" icon={Activity} loading={scan.isPending} value={String(all.length)} hint={`${formatNumber(scan.data?.checked ?? 0)} quotes tested`} highlight />
        <KpiCard label="Increases" icon={TrendingUp} loading={scan.isPending} value={String(all.filter((s) => s.direction === "increase").length)} hint="Fare spikes" />
        <KpiCard label="Decreases" icon={TrendingDown} loading={scan.isPending} value={String(all.filter((s) => s.direction === "decrease").length)} hint="Fare drops" />
        <KpiCard label="High or severe" icon={AlertOctagon} loading={scan.isPending} value={String(all.filter((s) => s.severity !== "moderate").length)} hint={`Robust z ≥ ${SHOCK_RULES.highZ}`} />
      </div>

      <Panel title="Index with shock dates" description="Red dots mark days with at least one alert. Click any point to explain that day's index change.">
        <QueryState query={history} isEmpty={(d) => !d.length} height={280}>
          {(data) => (
            <IndexTrendChart
              data={data}
              height={280}
              markers={[...new Set(all.map((s) => s.observedDate))]}
              onPointClick={(p) => setExplain({ period: "daily", periodStart: p.periodStart })}
            />
          )}
        </QueryState>
      </Panel>

      <Panel
        title="Fare shock alerts"
        description={`Change vs the quote's ${SHOCK_RULES.lookbackDays}-day rolling median. "Windows" = advance windows flagged / tested that day.`}
        actions={<ExportCsvButton rows={rows} columns={csv} filename={`fare-shocks-${dates.from}-to-${dates.to}.csv`} />}
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-2xl">
          <LabeledSelect
            id="sr-severity"
            label="Minimum severity"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: "all", label: "All severities" },
              { value: "high", label: "High and severe" },
              { value: "severe", label: "Severe only" },
            ]}
          />
          <LabeledSelect
            id="sr-direction"
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "all", label: "Increases and decreases" },
              { value: "increase", label: "Increases" },
              { value: "decrease", label: "Decreases" },
            ]}
          />
          <LabeledSelect
            id="sr-route"
            label="Route"
            value={route}
            onChange={setRoute}
            options={[{ value: "all", label: "All routes" }, ...ROUTES.map((r) => ({ value: r.id, label: routeLabel(r.id) }))]}
          />
        </div>
        <QueryState
          query={scan}
          isEmpty={() => !rows.length}
          empty={
            <p className="py-10 text-center text-sm text-muted-foreground">
              No alerts match. {all.length ? "Loosen the filters above." : "No unusual fares in this reporting period — try a longer period in the top bar."}
            </p>
          }
        >
          {() => <DataTable rows={rows} columns={columns} getRowId={(s) => s.id} caption="Fare shock alerts" initialSort={{ key: "time", dir: "desc" }} />}
        </QueryState>
      </Panel>

      <Panel title="How detection works" description="Transparent, reproducible rule — no machine-learning black box.">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Each comparable quote (route × airline × advance window) is compared with its own fares from the previous {SHOCK_RULES.lookbackDays} days.</li>
          <li>Baseline = median of those fares; spread = 1.4826 × median absolute deviation (MAD), floored at 1% of the median.</li>
          <li>
            Robust z = (today's fare − median) ÷ spread. A quote is flagged when |z| ≥ {SHOCK_RULES.zThreshold} <em>and</em> the fare moved at least {SHOCK_RULES.minChangePct}%.
          </li>
          <li>Flagged windows for the same route, airline and day form one alert. Severity: moderate (z &lt; {SHOCK_RULES.highZ}), high (&lt; {SHOCK_RULES.severeZ}), severe (≥ {SHOCK_RULES.severeZ}).</li>
          <li>
            Quotes with fewer than {SHOCK_RULES.minHistory} days of history are skipped, not guessed ({formatNumber(scan.data?.skippedInsufficientHistory ?? 0)} skipped). Missing days simply
            shorten the baseline.
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Medians and MAD resist the very spikes being detected, so one extreme fare cannot hide itself by inflating the baseline. Data-entry errors (e.g. 3× fares) are removed earlier by the
          cleaning step and never reach the radar. Airlines covered: {AIRLINES.map((a) => a.name).join(", ")}.
        </p>
      </Panel>

      <ExplainChangeSheet target={explain} onClose={() => setExplain(null)} />
    </div>
  );
}
