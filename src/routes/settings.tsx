import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, RefreshCw, XCircle } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { LabeledSelect } from "@/components/filters/LabeledSelect";
import { PeriodToggle } from "@/components/filters/PeriodToggle";
import { RANGE_OPTIONS } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { appConfig } from "@/config/appConfig";
import { usePreferences } from "@/hooks/usePreferences";
import { checkBackendHealth } from "@/services/api/client";
import type { ReportingRange } from "@/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Airfare Index India" },
      { name: "description", content: "Display preferences and backend connection status." },
    ],
  }),
  component: Settings,
});

const REFRESH_OPTIONS = [
  { value: "0", label: "Manual only" },
  { value: "5", label: "Every 5 minutes" },
  { value: "15", label: "Every 15 minutes" },
  { value: "60", label: "Every hour" },
];

function Row({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Settings() {
  const { prefs, setPref, resetPrefs, setRange } = usePreferences();
  const health = useQuery({ queryKey: ["backend-health"], queryFn: checkBackendHealth, enabled: Boolean(appConfig.apiBaseUrl) });

  const status = !appConfig.apiBaseUrl
    ? { icon: CircleSlash, tone: "text-muted-foreground", text: "Not configured — the app is running on built-in DEMO DATA." }
    : health.isPending
      ? { icon: RefreshCw, tone: "text-muted-foreground animate-spin", text: "Checking…" }
      : health.data?.ok
        ? { icon: CheckCircle2, tone: "text-success", text: health.data.message }
        : { icon: XCircle, tone: "text-destructive", text: health.data?.message ?? "Backend unreachable." };

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-5">
      <Panel title="Display preferences" description="Saved in this browser only.">
        <Row label="Reporting currency" hint="All fares are recorded in Indian rupees.">
          <span className="num rounded-sm border bg-muted px-2 py-1 text-xs">INR (₹)</span>
        </Row>
        <Row label="Default reporting period" hint="Used when the app opens. Also applied now.">
          <LabeledSelect
            id="set-range"
            label="Period"
            className="w-[160px]"
            value={prefs.defaultRange}
            onChange={(v) => {
              setPref("defaultRange", v as ReportingRange);
              setRange(v as ReportingRange);
            }}
            options={RANGE_OPTIONS}
          />
        </Row>
        <Row label="Preferred index view" hint="Default aggregation on the Overview and Airfare Index pages.">
          <PeriodToggle value={prefs.indexView} onChange={(v) => setPref("indexView", v)} />
        </Row>
        <Row label={<Label htmlFor="set-grid">Chart grid lines</Label>} hint="Horizontal guide lines on charts.">
          <Switch id="set-grid" checked={prefs.showGrid} onCheckedChange={(v) => setPref("showGrid", v)} />
        </Row>
        <Row label={<Label htmlFor="set-dots">Chart data points</Label>} hint="Mark each value on line charts.">
          <Switch id="set-dots" checked={prefs.showDataPoints} onCheckedChange={(v) => setPref("showDataPoints", v)} />
        </Row>
        <Row label="Data refresh interval" hint="How often the dashboard summary re-fetches.">
          <LabeledSelect
            id="set-refresh"
            label="Interval"
            className="w-[160px]"
            value={String(prefs.refreshIntervalMin)}
            onChange={(v) => setPref("refreshIntervalMin", Number(v))}
            options={REFRESH_OPTIONS}
          />
        </Row>
        <div className="pt-3">
          <Button variant="outline" size="sm" className="text-xs" onClick={resetPrefs}>
            Restore defaults
          </Button>
        </div>
      </Panel>

      <Panel
        title="Backend connection"
        description="FastAPI service (planned deployment on Render)."
        actions={
          appConfig.apiBaseUrl ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => health.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Test connection
            </Button>
          ) : undefined
        }
      >
        <p className="flex items-center gap-2 text-sm" role="status">
          <status.icon className={`h-4 w-4 ${status.tone}`} aria-hidden />
          {status.text}
        </p>
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-[180px_1fr]">
          <dt className="text-muted-foreground">API base URL</dt>
          <dd className="num break-all">{appConfig.apiBaseUrl || "— (VITE_API_BASE_URL not set)"}</dd>
          <dt className="text-muted-foreground">Data mode</dt>
          <dd>{appConfig.useMockData ? "DEMO DATA (mock service)" : "Live API"}</dd>
          <dt className="text-muted-foreground">Supabase</dt>
          <dd>{appConfig.supabase.url ? "URL configured" : "Not configured (not required for the demo)"}</dd>
        </dl>
      </Panel>
    </div>
  );
}
