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
import type { DateRange, FareObservation, IndexObservation, IndexPeriod, Route, RouteContribution } from "@/types";
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
    let wSum = 0;
    let vSum = 0;
    for (const r of routes) {
      const rel = perRoute.get(r.id);
      if (!rel?.length) continue; // missing route: re-weight over available routes
      const R = jevons(rel) * 100;
      routeRelatives[r.id] = R;
      wSum += r.trafficWeight;
      vSum += r.trafficWeight * R;
    }
    if (wSum > 0) points.push({ date, value: vSum / wSum, routeRelatives, observationCount: count });
  }
  return points;
}

const periodKey = (iso: string, p: IndexPeriod) =>
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
