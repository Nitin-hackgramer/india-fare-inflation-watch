import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CircleSlash, Database, Info, XCircle } from "lucide-react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Panel } from "@/components/dashboard/Panel";
import { QueryState } from "@/components/dashboard/StateViews";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { ExportCsvButton } from "@/components/tables/ExportCsvButton";
import { useSourcesStatus } from "@/hooks/useAirfareData";
import type { DataSourceStatus, SourceHealth } from "@/types";
import type { CsvColumn } from "@/utils/csv";
import { formatDateTime, formatNumber } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/data-sources")({
  head: () => ({
    meta: [
      { title: "Data Sources — Airfare Index India" },
      { name: "description", content: "Collection health for airline and OTA fare sources (simulated)." },
    ],
  }),
  component: DataSources,
});

const STATUS: Record<SourceHealth, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  operational: { label: "Operational", className: "border-success/40 bg-success/10 text-success", icon: CheckCircle2 },
  degraded: { label: "Degraded", className: "border-warning/50 bg-warning/15 text-warning-foreground", icon: AlertTriangle },
  failing: { label: "Failing", className: "border-destructive/40 bg-destructive/10 text-destructive", icon: XCircle },
  not_configured: { label: "Not configured", className: "border-border bg-muted text-muted-foreground", icon: CircleSlash },
};

function StatusPill({ status }: { status: SourceHealth }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium", s.className)}>
      <s.icon className="h-3 w-3" aria-hidden />
      {s.label}
    </span>
  );
}

const when = (iso: string | null) => (iso ? formatDateTime(iso) : "—");

const columns: Column<DataSourceStatus>[] = [
  { key: "name", header: "Source", cell: (s) => <span className="font-medium">{s.name}</span>, sortValue: (s) => s.name },
  { key: "type", header: "Type", cell: (s) => (s.type === "ota" ? "OTA" : "Airline"), sortValue: (s) => s.type },
  { key: "status", header: "Status", cell: (s) => <StatusPill status={s.status} />, sortValue: (s) => s.status },
  { key: "attempt", header: "Last attempt", cell: (s) => <span className="text-muted-foreground">{when(s.lastAttemptAt)}</span>, sortValue: (s) => s.lastAttemptAt ?? "" },
  { key: "success", header: "Last success", cell: (s) => <span className="text-muted-foreground">{when(s.lastSuccessAt)}</span>, sortValue: (s) => s.lastSuccessAt ?? "" },
  { key: "obs", header: "Observations", cell: (s) => formatNumber(s.observationsCollected), sortValue: (s) => s.observationsCollected, align: "right" },
  { key: "rate", header: "Success rate", cell: (s) => (s.successRate === null ? "—" : `${(s.successRate * 100).toFixed(1)}%`), sortValue: (s) => s.successRate ?? -1, align: "right" },
  { key: "errors", header: "Error summary", cell: (s) => <span className="text-xs text-muted-foreground">{s.errorSummary ?? "None"}</span> },
];

const csv: CsvColumn<DataSourceStatus>[] = [
  { header: "source_id", value: (s) => s.id },
  { header: "name", value: (s) => s.name },
  { header: "type", value: (s) => s.type },
  { header: "status", value: (s) => s.status },
  { header: "last_attempt_at", value: (s) => s.lastAttemptAt },
  { header: "last_success_at", value: (s) => s.lastSuccessAt },
  { header: "observations_collected", value: (s) => s.observationsCollected },
  { header: "failed_attempts", value: (s) => s.failedAttempts },
  { header: "success_rate", value: (s) => s.successRate?.toFixed(4) },
  { header: "error_summary", value: (s) => s.errorSummary },
  { header: "data_status", value: () => "DEMO DATA" },
];

function DataSources() {
  const sources = useSourcesStatus();
  const list = sources.data ?? [];
  const configured = list.filter((s) => s.configured);
  const count = (h: SourceHealth) => list.filter((s) => s.status === h).length;

  return (
    <div className="page-enter space-y-5">
      <div role="note" className="flex gap-2.5 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs text-warning-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <strong>DEMO DATA.</strong> Collection records below are simulated. No airline or OTA website is being accessed by this prototype. OTA sources are placeholders until
          access is approved and an ingestion worker is built.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Operational" icon={CheckCircle2} loading={sources.isPending} value={String(count("operational"))} hint={`of ${configured.length} configured`} />
        <KpiCard label="Degraded / failing" icon={AlertTriangle} loading={sources.isPending} value={String(count("degraded") + count("failing"))} hint="Success rate < 95%" />
        <KpiCard label="Not configured" icon={CircleSlash} loading={sources.isPending} value={String(count("not_configured"))} hint="Placeholders" />
        <KpiCard
          label="Observations collected"
          icon={Database}
          loading={sources.isPending}
          value={formatNumber(configured.reduce((s, x) => s + x.observationsCollected, 0))}
          hint={`${formatNumber(configured.reduce((s, x) => s + x.failedAttempts, 0))} failed attempts`}
        />
      </div>

      <Panel
        title="Source monitor"
        description="Per-source collection status over the full demo window. Healthy ≥ 95% success, degraded ≥ 80%."
        actions={<ExportCsvButton rows={list} columns={csv} filename="data-sources-status.csv" />}
      >
        <QueryState query={sources} isEmpty={(d) => !d.length}>
          {(rows) => <DataTable rows={rows} columns={columns} getRowId={(s) => s.id} caption="Data source status" pageSize={10} />}
        </QueryState>
      </Panel>

      <Panel title="Ingestion pipeline (planned)" description="How live sources will plug in without changing this page.">
        <ol className="grid gap-3 text-sm md:grid-cols-4">
          {[
            ["Collect", "Scheduled workers on Render request lowest economy fares per route × airline × window."],
            ["Store", "Raw quotes and attempt logs are written to Supabase (fare_observations, collection_attempts)."],
            ["Clean", "Failed attempts dropped, duplicate captures removed, outliers filtered (MAD rule)."],
            ["Serve", "FastAPI exposes GET /api/v1/sources/status; set VITE_API_BASE_URL to switch from demo data."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold text-heading">
                {i + 1}. {t}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
