/**
 * Memoised derivations of the demo dataset. Used only by services in mock mode;
 * a real backend replaces this with database queries.
 */
import type { DateRange, ReportingRange, ShockScan } from "@/types";
import { detectShocks } from "@/utils/shockDetection";
import { normalizeObservations, type NormalizationResult } from "@/utils/fareNormalization";
import { computeDailyIndex, type DailyIndexPoint } from "@/utils/indexCalculation";
import { addDays } from "@/utils/date";
import { BASE_PERIOD, DEMO_END_DATE, ROUTES, generateRawObservations } from "./mockData";

let normalized: NormalizationResult | null = null;
const dailyCache = new Map<string, DailyIndexPoint[]>();

export function getNormalized(): NormalizationResult {
  return (normalized ??= normalizeObservations(generateRawObservations()));
}

export function getDailyIndex(airlineCode?: string): DailyIndexPoint[] {
  const key = airlineCode ?? "all";
  if (!dailyCache.has(key)) {
    dailyCache.set(
      key,
      computeDailyIndex(getNormalized().clean, ROUTES, {
        basePeriod: BASE_PERIOD,
        filter: airlineCode ? (o) => o.airlineCode === airlineCode : undefined,
      }),
    );
  }
  return dailyCache.get(key)!;
}

let shockScan: ShockScan | null = null;
export const getShockScan = () => (shockScan ??= detectShocks(getNormalized().clean));

const RANGE_DAYS: Record<ReportingRange, number> = { "30d": 30, "90d": 90, "180d": 180 };

export function rangeToDates(range: ReportingRange): DateRange {
  return { from: addDays(DEMO_END_DATE, -(RANGE_DAYS[range] - 1)), to: DEMO_END_DATE };
}
