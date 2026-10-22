import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { IndexObservation } from "@/types";
import { chartAxis, tooltipStyle } from "@/config/chartTheme";
import { usePreferences } from "@/hooks/usePreferences";
import { formatIndex, formatPct } from "@/utils/format";

interface Props {
  data: IndexObservation[];
  height?: number;
  /** Called with the clicked period (enables "Explain this change" on chart points). */
  onPointClick?: (p: IndexObservation) => void;
  /** Period starts to mark (e.g. dates with fare-shock alerts). */
  markers?: string[];
}

export function IndexTrendChart({ data, height = 280, onPointClick, markers }: Props) {
  const { prefs } = usePreferences();
  const marked = markers?.length ? data.filter((d) => markers.includes(d.periodStart)) : [];
  return (
    <div style={{ height }} role="img" aria-label="Airfare index trend line chart" className={onPointClick ? "cursor-pointer" : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
          onClick={(s: { activePayload?: { payload: IndexObservation }[] } | null) => {
            const p = s?.activePayload?.[0]?.payload;
            if (p && onPointClick) onPointClick(p);
          }}
        >
          {prefs.showGrid && <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />}
          <XAxis dataKey="periodLabel" {...chartAxis} minTickGap={24} />
          <YAxis {...chartAxis} domain={["auto", "auto"]} width={48} tickFormatter={(v: number) => v.toFixed(0)} />
          <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "Base = 100", fontSize: 10, fill: "var(--muted-foreground)", position: "insideTopLeft" }} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number, _n, item) => [
              `${formatIndex(v)}  (${formatPct((item.payload as IndexObservation).changePct)})${onPointClick ? "  · click to explain" : ""}`,
              "Index",
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={prefs.showDataPoints ? { r: 2 } : false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          {marked.map((d) => (
            <ReferenceDot key={d.periodStart} x={d.periodLabel} y={d.value} r={5} fill="var(--destructive)" stroke="var(--card)" strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
