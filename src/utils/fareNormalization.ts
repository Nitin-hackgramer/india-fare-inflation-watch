import type { FareObservation } from "@/types";

export interface NormalizationResult {
  clean: FareObservation[];
  stats: { raw: number; failed: number; duplicates: number; outliers: number; retained: number };
}

/** Key identifying one comparable price quote on one collection date. */
export const quoteKey = (o: FareObservation) =>
  `${o.routeId}|${o.airlineCode}|${o.advanceDays}|${o.observedDate}`;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * 1. Drop failed collections (no fare).
 * 2. De-duplicate repeated captures of the same quote, keeping the earliest.
 * 3. Remove outliers beyond `madThreshold` robust deviations from the
 *    route × advance-window median (median absolute deviation).
 */
export function normalizeObservations(raw: FareObservation[], madThreshold = 5): NormalizationResult {
  const successful = raw.filter((o) => o.status === "success" && o.fare !== null);

  const byKey = new Map<string, FareObservation>();
  for (const o of successful) {
    const k = quoteKey(o);
    const prev = byKey.get(k);
    if (!prev || o.collectedAt < prev.collectedAt) byKey.set(k, o);
  }
  const deduped = [...byKey.values()];

  const groups = new Map<string, FareObservation[]>();
  for (const o of deduped) {
    const g = `${o.routeId}|${o.advanceDays}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(o);
  }
  const clean: FareObservation[] = [];
  for (const items of groups.values()) {
    const fares = items.map((o) => o.fare!);
    const med = median(fares);
    const mad = median(fares.map((f) => Math.abs(f - med))) * 1.4826 || 1;
    for (const o of items) if (Math.abs(o.fare! - med) / mad <= madThreshold) clean.push(o);
  }
  clean.sort((a, b) => (a.collectedAt < b.collectedAt ? -1 : 1));

  return {
    clean,
    stats: {
      raw: raw.length,
      failed: raw.length - successful.length,
      duplicates: successful.length - deduped.length,
      outliers: deduped.length - clean.length,
      retained: clean.length,
    },
  };
}
