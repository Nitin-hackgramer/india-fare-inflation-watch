import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryValue } from "@/types";
import { chartAxis, tooltipStyle } from "@/config/chartTheme";
import { usePreferences } from "@/hooks/usePreferences";

interface Props {
  data: CategoryValue[];
  orientation?: "horizontal" | "vertical";
  format: (v: number) => string;
  height?: number;
  color?: string;
  colorFor?: (key: string) => string;
  /** Highlight a single bar key in the primary colour. */
  highlightKey?: string;
  ariaLabel: string;
}

export function CategoryBarChart({ data, orientation = "vertical", format, height = 260, color = "var(--chart-2)", colorFor, highlightKey, ariaLabel }: Props) {
  const { prefs } = usePreferences();
  const horizontal = orientation === "horizontal";
  const fill = (key: string) => (highlightKey === key ? "var(--chart-1)" : colorFor?.(key) ?? color);
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: horizontal ? 64 : 8, left: horizontal ? 8 : -8, bottom: 0 }}>
          {prefs.showGrid && <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />}
          {/* Recharts 2 ignores axes wrapped in fragments, so each axis is a direct child. */}
          {horizontal ? (
            <XAxis type="number" {...chartAxis} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          ) : (
            <XAxis dataKey="label" {...chartAxis} interval={0} tick={{ fontSize: 10 }} />
          )}
          {horizontal ? (
            <YAxis type="category" dataKey="label" {...chartAxis} width={110} />
          ) : (
            <YAxis {...chartAxis} width={48} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          )}
          <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v: number, _n, item) => [`${format(v)}  ·  n=${(item.payload as CategoryValue).count}`, "Avg fare"]} />
          <Bar dataKey="value" radius={2} maxBarSize={horizontal ? 18 : 40} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={fill(d.key)} />
            ))}
            {horizontal && <LabelList dataKey="value" position="right" formatter={(v: number) => format(v)} style={{ fontSize: 11, fill: "var(--foreground)" }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
