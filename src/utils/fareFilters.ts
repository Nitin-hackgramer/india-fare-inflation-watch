import type { AdvanceWindow, CategoryValue, FareFilter, FareMover, FareObservation } from "@/types";
import { inRange } from "@/utils/date";

export function filterObservations(obs: FareObservation[], f: FareFilter): FareObservation[] {
  return obs.filter((o) => {
    const [orig, dest] = o.routeId.split("-");
    if (f.origin && orig !== f.origin) return false;
    if (f.destination && dest !== f.destination) return false;
    if (f.airlineCode && o.airlineCode !== f.airlineCode) return false;
    if (f.advanceDays && o.advanceDays !== f.advanceDays) return false;
    if (f.travelDate && o.travelDate !== f.travelDate) return false;
    return inRange(o.observedDate, f.from, f.to);
  });
}

export interface FareStats {
  min: number;
  max: number;
  avg: number;
  count: number;
}

export function fareStats(obs: FareObservation[]): FareStats | null {
  const fares = obs.map((o) => o.fare).filter((f): f is number => f !== null);
  if (!fares.length) return null;
  return {
    min: Math.min(...fares),
    max: Math.max(...fares),
    avg: fares.reduce((s, f) => s + f, 0) / fares.length,
    count: fares.length,
  };
}

/** Lowest / average / highest fare per group key (e.g. per airline). */
export function fareStatsBy(obs: FareObservation[], key: (o: FareObservation) => string): Map<string, FareStats> {
  const groups = new Map<string, FareObservation[]>();
  for (const o of obs) {
    const k = key(o);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(o);
  }
  const out = new Map<string, FareStats>();
  for (const [k, g] of groups) {
    const s = fareStats(g);
    if (s) out.set(k, s);
  }
  return out;
}

/** Average fare per airline × advance window: matrix[airline][window] = avg. */
export function fareMatrix(obs: FareObservation[]): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {};
  for (const [k, s] of fareStatsBy(obs, (o) => `${o.airlineCode}|${o.advanceDays}`)) {
    const [airline, w] = k.split("|");
    (out[airline] ??= {})[Number(w)] = Math.round(s.avg);
  }
  return out;
}

/** Compare the same quote (route × airline × window) between two sets of observations. */
export function compareFares(prev: FareObservation[], cur: FareObservation[]): FareMover[] {
  const key = (o: FareObservation) => `${o.routeId}|${o.airlineCode}|${o.advanceDays}`;
  const p = fareStatsBy(prev, key);
  const c = fareStatsBy(cur, key);
  return [...new Set([...p.keys(), ...c.keys()])].map((k) => {
    const [routeId, airlineCode, w] = k.split("|");
    const a = p.get(k);
    const b = c.get(k);
    return {
      routeId,
      airlineCode,
      advanceDays: Number(w) as AdvanceWindow,
      prevAvg: a ? Math.round(a.avg) : null,
      curAvg: b ? Math.round(b.avg) : null,
      changePct: a && b ? (b.avg / a.avg - 1) * 100 : null,
      n: (a?.count ?? 0) + (b?.count ?? 0),
    };
  });
}

/** Average fare grouped by an arbitrary key. */
export function averageBy(
  obs: FareObservation[],
  key: (o: FareObservation) => string,
  label: (k: string) => string = (k) => k,
): CategoryValue[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const o of obs) {
    if (o.fare === null) continue;
    const k = key(o);
    const a = acc.get(k) ?? { sum: 0, n: 0 };
    a.sum += o.fare;
    a.n += 1;
    acc.set(k, a);
  }
  return [...acc].map(([k, a]) => ({ key: k, label: label(k), value: Math.round(a.sum / a.n), count: a.n }));
}

/** Daily average fare per airline: rows of { date, [airlineCode]: avg }. */
export function dailyAverageByAirline(obs: FareObservation[]): Array<Record<string, string | number>> {
  const acc = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const o of obs) {
    if (o.fare === null) continue;
    if (!acc.has(o.observedDate)) acc.set(o.observedDate, new Map());
    const m = acc.get(o.observedDate)!;
    const a = m.get(o.airlineCode) ?? { sum: 0, n: 0 };
    a.sum += o.fare;
    a.n += 1;
    m.set(o.airlineCode, a);
  }
  return [...acc.keys()].sort().map((date) => {
    const row: Record<string, string | number> = { date };
    for (const [code, a] of acc.get(date)!) row[code] = Math.round(a.sum / a.n);
    return row;
  });
}
