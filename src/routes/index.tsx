import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExplainChangeSheet, type ExplainTarget } from "@/components/shock/ExplainChangeSheet";
import { ShockAlertList } from "@/components/shock/ShockAlertList";
import { CalendarDays, CalendarRange, CheckCircle2, Clock, Database, Gauge, Radio, Route as RouteIcon, TrendingUp, XCircle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Panel } from "@/components/dashboard/Panel";
import { QueryState } from "@/components/dashboard/StateViews";
import { IndexTrendChart } from "@/components/charts/IndexTrendChart";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { PeriodToggle } from "@/components/filters/PeriodToggle";
import { DataTable } from "@/components/tables/DataTable";
import { observationColumns } from "@/components/tables/observationColumns";
import { AIRLINE_COLORS } from "@/config/chartTheme";
import { useDashboardSummary, useFareComparisons, useIndexHistory, useRecentObservations, useShocks } from "@/hooks/useAirfareData";
import { usePreferences } from "@/hooks/usePreferences";
import { rangeToDates } from "@/services/data/mockRepository";
import type { IndexPeriod } from "@/types";
import { formatDate, formatDateTime, formatINR, formatIndex, formatNumber, formatPct } from "@/utils/format";

// No head() here: the home route inherits title/description from __root.tsx.
export const Route = createFileRoute("/")({
  component: Overview,
});

function Overview() {
  const { prefs, range } = usePreferences();
  const [period, setPeriod] = useState<IndexPeriod>(prefs.indexView);
  const summary = useDashboardSummary(range);
  const history = useIndexHistory(period, rangeToDates(range));
  const comparisons = useFareComparisons(range);
  const recent = useRecentObservations(50);
  const shocks = useShocks(rangeToDates(range));
  const [explain, setExplain] = useState<ExplainTarget | null>(null);
  const s = summary.data;
  const loading = summary.isPending;

  return (
    <div className="page-enter space-y-5">
      <p className="text-xs text-muted-foreground">
        {s ? (
          <>
            Base period {formatDate(s.basePeriod.from)} – {formatDate(s.basePeriod.to)} = 100 · Reporting {formatDate(s.reportingRange.from)} – {formatDate(s.reportingRange.to)}
          </>
        ) : (
          "Loading reporting window…"
        )}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Airfare Price Index" icon={Gauge} loading={loading} value={s && formatIndex(s.currentIndex)} hint="Base = 100" highlight />
        <KpiCard label="Daily change" icon={TrendingUp} loading={loading} trend={s?.dailyChangePct} value={formatPct(s?.dailyChangePct ?? null)} hint="vs previous day" />
        <KpiCard label="Weekly change" icon={CalendarDays} loading={loading} trend={s?.weeklyChangePct} value={formatPct(s?.weeklyChangePct ?? null)} hint="vs 7 days earlier" />
        <KpiCard label="Monthly change" icon={CalendarRange} loading={loading} trend={s?.monthlyChangePct} value={formatPct(s?.monthlyChangePct ?? null)} hint="vs 30 days earlier" />
        <KpiCard label="Routes tracked" icon={RouteIcon} loading={loading} value={s && String(s.routesTracked)} hint="Traffic-weighted basket" />
        <KpiCard label="Fare observations" icon={Database} loading={loading} value={s && formatNumber(s.fareObservations)} hint="Cleaned, in period" />
      </div>

      <Panel
        title="Airfare Index trend"
        description="Traffic-weighted index of comparable economy fares. Dashed line = base (100). Click a point to explain its change."
        actions={<PeriodToggle value={period} onChange={setPeriod} />}
      >
        <QueryState query={history} isEmpty={(d) => !d.length} height={300}>
          {(data) => (
            <IndexTrendChart
              data={data}
              height={300}
              markers={period === "daily" ? shocks.data?.shocks.map((s) => s.observedDate) : undefined}
              onPointClick={(p) => setExplain({ period, periodStart: p.periodStart })}
            />
          )}
        </QueryState>
      </Panel>

      <Panel
        title="Airfare Shock Radar"
        description="Latest statistically unusual fare moves. Detected, not confirmed causes."
        actions={
          <Link to="/shock-radar" className="text-xs font-medium text-heading underline-offset-2 hover:underline">
            View all alerts
          </Link>
        }
      >
        <QueryState query={shocks} isEmpty={(d) => !d.shocks.length} empty={<p className="py-6 text-center text-sm text-muted-foreground">No unusual fare moves in this reporting period.</p>}>
          {(d) => <ShockAlertList shocks={d.shocks.slice(0, 4)} onExplain={(s) => setExplain({ period: "daily", periodStart: s.observedDate, routeId: s.routeId })} />}
        </QueryState>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Route-wise fare comparison" description="Average observed fare per route, all airlines and windows.">
          <QueryState query={comparisons} height={260}>
            {(d) => <CategoryBarChart data={d.byRoute} orientation="horizontal" format={formatINR} ariaLabel="Average fare by route" />}
          </QueryState>
        </Panel>
        <Panel title="Airline comparison" description="Average observed fare per airline across the route basket.">
          <QueryState query={comparisons} height={260}>
            {(d) => <CategoryBarChart data={d.byAirline} format={formatINR} colorFor={(k) => AIRLINE_COLORS[k]} ariaLabel="Average fare by airline" />}
          </QueryState>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Advance-purchase analysis" description="Average fare by days between booking and travel." className="lg:col-span-2">
          <QueryState query={comparisons} height={260}>
            {(d) => <CategoryBarChart data={d.byWindow} format={formatINR} highlightKey="1" ariaLabel="Average fare by advance-purchase window" />}
          </QueryState>
        </Panel>
        <Panel title="Data collection health" description="Collection attempts in the reporting period.">
          {loading || !s ? (
            <QueryState query={summary}>{() => null}</QueryState>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <HealthItem icon={CheckCircle2} label="Successful" value={formatNumber(s.health.successful)} tone="text-success" />
              <HealthItem icon={XCircle} label="Failed" value={formatNumber(s.health.failed)} tone="text-destructive" />
              <HealthItem icon={Radio} label="Source coverage" value={`${s.health.activeSources} / ${s.health.totalSources}`} />
              <HealthItem
                icon={Gauge}
                label="Success rate"
                value={`${((s.health.successful / Math.max(1, s.health.successful + s.health.failed)) * 100).toFixed(1)}%`}
              />
              <div className="col-span-2">
                <HealthItem icon={Clock} label="Last collection" value={formatDateTime(s.health.lastCollectionAt)} />
              </div>
            </dl>
          )}
        </Panel>
      </div>

      <Panel title="Recent observations" description="Latest cleaned fare quotes (economy, lowest available).">
        <QueryState query={recent} isEmpty={(d) => !d.length}>
          {(rows) => (
            <DataTable rows={rows} columns={observationColumns} getRowId={(o) => o.id} caption="Recent fare observations" initialSort={{ key: "collected", dir: "desc" }} />
          )}
        </QueryState>
      </Panel>

      <ExplainChangeSheet target={explain} onClose={() => setExplain(null)} />
    </div>
  );
}

function HealthItem({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tone ?? ""}`} aria-hidden />
        {label}
      </dt>
      <dd className="num mt-1 text-base font-semibold">{value}</dd>
    </div>
  );
}
