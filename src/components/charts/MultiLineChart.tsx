import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartAxis, tooltipStyle } from "@/config/chartTheme";
import { usePreferences } from "@/hooks/usePreferences";

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

interface Props {
  data: Array<Record<string, string | number>>;
  xKey: string;
  series: SeriesDef[];
  format: (v: number) => string;
  xFormat?: (v: string) => string;
  yFormat?: (v: number) => string;
  height?: number;
  ariaLabel: string;
}

export function MultiLineChart({ data, xKey, series, format, xFormat, yFormat, height = 300, ariaLabel }: Props) {
  const { prefs } = usePreferences();
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          {prefs.showGrid && <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />}
          <XAxis dataKey={xKey} {...chartAxis} minTickGap={24} tickFormatter={xFormat} />
          <YAxis {...chartAxis} width={52} domain={["auto", "auto"]} tickFormatter={yFormat} />
          <Tooltip {...tooltipStyle} labelFormatter={(l: string) => (xFormat ? xFormat(l) : l)} formatter={(v: number, name: string) => [format(v), series.find((s) => s.key === name)?.label ?? name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => series.find((s) => s.key === v)?.label ?? v} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={1.75} dot={prefs.showDataPoints ? { r: 2 } : false} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
