/** Chart colours reference design tokens so they follow the design system. */
export const AIRLINE_COLORS: Record<string, string> = {
  "6E": "var(--chart-3)",
  AI: "var(--chart-1)",
  IX: "var(--chart-4)",
  QP: "var(--chart-5)",
  SG: "var(--chart-2)",
};

export const chartAxis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
} as const;
