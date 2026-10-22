/**
 * Prototype airfare index (methodology version "prototype-0.1").
 *
 * - Elementary cell = route × airline × advance-purchase window.
 * - Cell base price = mean fare over the base period.
 * - Route relative = Jevons (geometric mean) of cell price relatives × 100.
 * - Overall index = traffic-weighted arithmetic mean of route relatives
 *   (Laspeyres-type, weights fixed in the base period).
 *
 * Pure functions only — the FastAPI backend can reproduce this exactly.
 * This is an illustrative prototype, NOT an official CPI / MoSPI methodology.
 */
import type { DateRange, FareObservation, IndexObservation, IndexPeriod, PeriodRelatives, Route, RouteContribution } from "@/types";
import { inRange, monthStart, weekStart } from "@/utils/date";
import { formatPeriodLabel } from "@/utils/format";

export const METHOD_VERSION = "prototype-0.1";

export interface DailyIndexPoint {
  date: string;
  value: number;
  routeRelatives: Record<string, number>;
  observationCount: number;
}

const cellKey = (o: FareObservation) => `${o.routeId}|${o.airlineCode}|${o.advanceDays}`;

export function percentChange(current: number, previous: number | undefined | null): number | null {
  if (previous === undefined || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function jevons(relatives: number[]): number {
  if (!relatives.length) return NaN;
  return Math.exp(relatives.reduce((s, r) => s + Math.log(r), 0) / relatives.length);
}

export function computeBaseFares(obs: FareObservation[], base: DateRange): Map<string, number> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const o of obs) {
    if (o.fare === null || !inRange(o.observedDate, base.from, base.to)) continue;
    const k = cellKey(o);
    const a = acc.get(k) ?? { sum: 0, n: 0 };
    a.sum += o.fare;
    a.n += 1;
    acc.set(k, a);
  }
  return new Map([...acc].map(([k, a]) => [k, a.sum / a.n]));
}

export function computeDailyIndex(
  obs: FareObservation[],
  routes: Route[],
  opts: { basePeriod: DateRange; filter?: (o: FareObservation) => boolean },
): DailyIndexPoint[] {
  const subset = opts.filter ? obs.filter(opts.filter) : obs;
  const base = computeBaseFares(subset, opts.basePeriod);

  // date -> cell -> fares
  const byDate = new Map<string, Map<string, number[]>>();
  for (const o of subset) {
    if (o.fare === null) continue;
    if (!byDate.has(o.observedDate)) byDate.set(o.observedDate, new Map());
    const cells = byDate.get(o.observedDate)!;
    const k = cellKey(o);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(o.fare);
  }

  const points: DailyIndexPoint[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const cells = byDate.get(date)!;
    const perRoute = new Map<string, number[]>();
    let count = 0;
    for (const [k, fares] of cells) {
      const b = base.get(k);
      if (!b) continue; // no comparable base price -> excluded
      const mean = fares.reduce((s, f) => s + f, 0) / fares.length;
      const routeId = k.split("|")[0];
      if (!perRoute.has(routeId)) perRoute.set(routeId, []);
      perRoute.get(routeId)!.push(mean / b);
      count += fares.length;
    }
    const routeRelatives: Record<string, number> = {};
    for (const [routeId, rel] of perRoute) routeRelatives[routeId] = jevons(rel) * 100;
    const value = weightedIndex(routeRelatives, routes);
    if (value !== null) points.push({ date, value, routeRelatives, observationCount: count });
  }
  return points;
}

/** Overall index = Σ w·R ÷ Σ w over routes that have a relative (missing routes re-weighted away). */
export function weightedIndex(routeRelatives: Record<string, number>, routes: Route[]): number | null {
  let wSum = 0;
  let vSum = 0;
  for (const r of routes) {
    const R = routeRelatives[r.id];
    if (R === undefined || !(r.trafficWeight > 0)) continue;
    wSum += r.trafficWeight;
    vSum += r.trafficWeight * R;
  }
  return wSum > 0 ? vSum / wSum : null;
}

export const periodKey = (iso: string, p: IndexPeriod) =>
  p === "daily" ? iso : p === "weekly" ? weekStart(iso) : monthStart(iso);

/** Aggregate daily points to a period by simple averaging of daily index values. */
export function aggregateIndex(daily: DailyIndexPoint[], period: IndexPeriod): IndexObservation[] {
  const groups = new Map<string, { sum: number; n: number; count: number }>();
  for (const p of daily) {
    const k = periodKey(p.date, period);
    const g = groups.get(k) ?? { sum: 0, n: 0, count: 0 };
    g.sum += p.value;
    g.n += 1;
    g.count += p.observationCount;
    groups.set(k, g);
  }
  const out: IndexObservation[] = [];
  let prev: number | undefined;
  for (const k of [...groups.keys()].sort()) {
    const g = groups.get(k)!;
    const value = g.sum / g.n;
    out.push({
      periodStart: k,
      periodLabel: formatPeriodLabel(k, period),
      value,
      changePct: percentChange(value, prev),
      observationCount: g.count,
    });
    prev = value;
  }
  return out;
}

/** % change between the last point and the point `lag` days earlier. */
export function changeOverDays(daily: DailyIndexPoint[], lag: number): number | null {
  if (daily.length <= lag) return null;
  return percentChange(daily[daily.length - 1].value, daily[daily.length - 1 - lag].value);
}

/**
 * Per-period route relatives: each route's daily relatives averaged within the period,
 * then combined with the same weights as the daily index. For a daily period this is the daily point.
 */
export function aggregateRouteRelatives(daily: DailyIndexPoint[], period: IndexPeriod, routes: Route[]): PeriodRelatives[] {
  const groups = new Map<string, DailyIndexPoint[]>();
  for (const p of daily) {
    const k = periodKey(p.date, period);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  const out: PeriodRelatives[] = [];
  for (const k of [...groups.keys()].sort()) {
    const pts = groups.get(k)!;
    const acc = new Map<string, number[]>();
    for (const p of pts) for (const [id, R] of Object.entries(p.routeRelatives)) acc.set(id, [...(acc.get(id) ?? []), R]);
    const routeRelatives = Object.fromEntries([...acc].map(([id, rs]) => [id, rs.reduce((s, x) => s + x, 0) / rs.length]));
    const value = weightedIndex(routeRelatives, routes);
    if (value === null) continue;
    out.push({ periodStart: k, periodLabel: formatPeriodLabel(k, period), value, routeRelatives, observationCount: pts.reduce((s, p) => s + p.observationCount, 0) });
  }
  return out;
}

/**
 * Attribute an index move to routes: contribution(r) = w(r) ÷ W × (R_cur(r) − R_prev(r)),
 * W = total weight of routes present in BOTH periods. Contributions sum to the index change
 * whenever route coverage is unchanged; any gap is returned as `residualPts`.
 * This is arithmetic attribution through the index formula — not evidence of a cause.
 */
export function explainIndexChange(prev: PeriodRelatives, cur: PeriodRelatives, routes: Route[]): { contributions: RouteContribution[]; residualPts: number } {
  const both = routes.filter((r) => prev.routeRelatives[r.id] !== undefined && cur.routeRelatives[r.id] !== undefined && r.trafficWeight > 0);
  const W = both.reduce((s, r) => s + r.trafficWeight, 0);
  const contributions = both
    .map((r) => {
      const start = prev.routeRelatives[r.id];
      const end = cur.routeRelatives[r.id];
      return {
        routeId: r.id,
        weight: r.trafficWeight / W,
        startRelative: start,
        endRelative: end,
        changePct: ((end - start) / start) * 100,
        contributionPts: (r.trafficWeight / W) * (end - start),
      };
    })
    .sort((a, b) => Math.abs(b.contributionPts) - Math.abs(a.contributionPts));
  const explained = contributions.reduce((s, c) => s + c.contributionPts, 0);
  return { contributions, residualPts: cur.value - prev.value - explained };
}

export interface ScenarioInput {
  routeId: string;
  /** Hypothetical % change applied to every fare on the route, e.g. 10 = +10%. */
  farePct: number;
  /** Optional replacement weight for the route (others keep theirs; all are re-normalised). */
  weight?: number;
}

export interface ScenarioPoint {
  periodStart: string;
  periodLabel: string;
  baseline: number;
  simulated: number;
  routeBaseline: number | null;
  routeSimulated: number | null;
}

/**
 * What-if: scale one route's fares by (1 + farePct/100) and recompute the index.
 * Multiplying every fare on a route by k multiplies each price relative by k, and the Jevons
 * (geometric) mean scales by exactly k — so the route relative becomes R × k. Pure: inputs are copied, never mutated.
 */
export function simulateIndex(points: PeriodRelatives[], routes: Route[], s: ScenarioInput): ScenarioPoint[] {
  const k = 1 + s.farePct / 100;
  const simRoutes = s.weight === undefined ? routes : routes.map((r) => (r.id === s.routeId ? { ...r, trafficWeight: s.weight! } : r));
  return points.map((p) => {
    const base = p.routeRelatives[s.routeId];
    const rel = base === undefined ? p.routeRelatives : { ...p.routeRelatives, [s.routeId]: base * k };
    return {
      periodStart: p.periodStart,
      periodLabel: p.periodLabel,
      baseline: weightedIndex(p.routeRelatives, routes) ?? p.value,
      simulated: weightedIndex(rel, simRoutes) ?? p.value,
      routeBaseline: base ?? null,
      routeSimulated: base === undefined ? null : base * k,
    };
  });
}

export function routeContributions(
  daily: DailyIndexPoint[],
  routes: Route[],
  range: DateRange,
): RouteContribution[] {
  const slice = daily.filter((p) => inRange(p.date, range.from, range.to));
  if (slice.length < 1) return [];
  const first = slice[0];
  const last = slice[slice.length - 1];
  const totalW = routes.reduce((s, r) => s + r.trafficWeight, 0);
  return routes
    .filter((r) => first.routeRelatives[r.id] && last.routeRelatives[r.id])
    .map((r) => {
      const start = first.routeRelatives[r.id];
      const end = last.routeRelatives[r.id];
      return {
        routeId: r.id,
        weight: r.trafficWeight / totalW,
        startRelative: start,
        endRelative: end,
        changePct: ((end - start) / start) * 100,
        contributionPts: (r.trafficWeight / totalW) * (end - start),
      };
    });
}
