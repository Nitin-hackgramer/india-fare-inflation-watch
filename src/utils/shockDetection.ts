/**
 * Airfare Shock Radar — rolling robust anomaly detection.
 *
 * For every comparable quote (route × airline × advance window) on date t:
 *   baseline  = that quote's fares in the previous `lookbackDays` days (t excluded)
 *   m         = median(baseline)
 *   s         = 1.4826 × median(|baseline − m|)        (MAD, scaled to σ for normal data)
 *   z         = (fare_t − m) ÷ max(s, 1% of m)
 *   change    = (fare_t ÷ m − 1) × 100
 * A quote is flagged when |z| ≥ zThreshold AND |change| ≥ minChangePct.
 * Quotes with fewer than `minHistory` baseline fares are skipped, not guessed.
 * Flagged quotes are grouped per route × airline × date × direction into one alert.
 *
 * Detection says a fare is statistically unusual for its own recent history.
 * It does NOT identify a cause. Pure functions; the backend can reproduce them.
 */
import type { AdvanceWindow, FareObservation, FareShock, ShockScan, ShockSeverity } from "@/types";
import { addDays } from "@/utils/date";
import { median } from "@/utils/fareNormalization";

export const SHOCK_RULES = {
  lookbackDays: 14,
  minHistory: 7,
  zThreshold: 3.5,
  minChangePct: 20,
  /** |median z| at or above these → high / severe; otherwise moderate. */
  highZ: 6,
  severeZ: 9,
};
export type ShockRules = typeof SHOCK_RULES;

export function severityOf(absZ: number, rules: ShockRules = SHOCK_RULES): ShockSeverity {
  return absZ >= rules.severeZ ? "severe" : absZ >= rules.highZ ? "high" : "moderate";
}

interface Flag {
  o: FareObservation;
  z: number;
  pct: number;
  base: number;
  history: number;
}

export function detectShocks(obs: FareObservation[], rules: ShockRules = SHOCK_RULES): ShockScan {
  const cells = new Map<string, FareObservation[]>();
  for (const o of obs) {
    if (o.fare === null) continue;
    const k = `${o.routeId}|${o.airlineCode}|${o.advanceDays}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(o);
  }

  let checked = 0;
  let skipped = 0;
  const flags: Flag[] = [];
  const observedPerGroup = new Map<string, number>(); // route|airline|date -> testable windows

  for (const series of cells.values()) {
    series.sort((a, b) => a.observedDate.localeCompare(b.observedDate));
    let start = 0;
    for (let i = 0; i < series.length; i++) {
      const o = series[i];
      const from = addDays(o.observedDate, -rules.lookbackDays);
      while (series[start].observedDate < from) start++;
      const history = series.slice(start, i).map((h) => h.fare!);
      if (history.length < rules.minHistory) {
        skipped++;
        continue;
      }
      checked++;
      const g = `${o.routeId}|${o.airlineCode}|${o.observedDate}`;
      observedPerGroup.set(g, (observedPerGroup.get(g) ?? 0) + 1);
      const m = median(history);
      const s = Math.max(median(history.map((f) => Math.abs(f - m))) * 1.4826, m * 0.01);
      const z = (o.fare! - m) / s;
      const pct = (o.fare! / m - 1) * 100;
      if (Math.abs(z) >= rules.zThreshold && Math.abs(pct) >= rules.minChangePct) flags.push({ o, z, pct, base: m, history: history.length });
    }
  }

  const groups = new Map<string, Flag[]>();
  for (const f of flags) {
    const k = `${f.o.routeId}|${f.o.airlineCode}|${f.o.observedDate}|${f.z > 0 ? "up" : "down"}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(f);
  }

  const shocks: FareShock[] = [...groups].map(([k, fs]) => {
    const { routeId, airlineCode, observedDate } = fs[0].o;
    const z = median(fs.map((f) => f.z));
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    return {
      id: `shock-${k.replace(/\|/g, "-")}`,
      routeId,
      airlineCode,
      observedDate,
      collectedAt: fs.reduce((m, f) => (f.o.collectedAt > m ? f.o.collectedAt : m), ""),
      direction: z > 0 ? "increase" : "decrease",
      changePct: median(fs.map((f) => f.pct)),
      robustZ: z,
      severity: severityOf(Math.abs(z), rules),
      windows: fs.map((f) => f.o.advanceDays as AdvanceWindow).sort((a, b) => a - b),
      cellsObserved: observedPerGroup.get(`${routeId}|${airlineCode}|${observedDate}`) ?? fs.length,
      baselineAvgFare: mean(fs.map((f) => f.base)),
      currentAvgFare: mean(fs.map((f) => f.o.fare!)),
      sampleSize: fs.reduce((s, f) => s + f.history + 1, 0),
    };
  });

  shocks.sort((a, b) => b.observedDate.localeCompare(a.observedDate) || Math.abs(b.robustZ) - Math.abs(a.robustZ));
  return { shocks, checked, skippedInsufficientHistory: skipped };
}
