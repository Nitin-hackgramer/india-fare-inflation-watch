import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { IndexObservation } from "@/types";
import { chartAxis, tooltipStyle } from "@/config/chartTheme";
import { usePreferences } from "@/hooks/usePreferences";
import { formatIndex, formatPct } from "@/utils/format";

export function IndexTrendChart({ data, height = 280 }: { data: IndexObservation[]; height?: number }) {
  const { prefs } = usePreferences();
  return (
    <div style={{ height }} role="img" aria-label="Airfare index trend line chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          {prefs.showGrid && <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />}
          <XAxis dataKey="periodLabel" {...chartAxis} minTickGap={24} />
          <YAxis {...chartAxis} domain={["auto", "auto"]} width={48} tickFormatter={(v: number) => v.toFixed(0)} />
          <ReferenceLine y={100} stroke="var(--muted-foreground)" strokeDasharray="4 4" label={{ value: "Base = 100", fontSize: 10, fill: "var(--muted-foreground)", position: "insideTopLeft" }} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number, _n, item) => [
              `${formatIndex(v)}  (${formatPct((item.payload as IndexObservation).changePct)})`,
              "Index",
            ]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={prefs.showDataPoints ? { r: 2 } : false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
