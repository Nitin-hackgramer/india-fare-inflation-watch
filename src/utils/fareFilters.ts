import type { CategoryValue, FareFilter, FareObservation } from "@/types";
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
