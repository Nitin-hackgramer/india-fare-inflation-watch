import { describe, expect, it } from "vitest";
import type { FareObservation, Route } from "@/types";
import { aggregateIndex, computeDailyIndex, jevons, percentChange } from "@/utils/indexCalculation";
import { fareMatrix, fareStats, filterObservations } from "@/utils/fareFilters";
import { normalizeObservations } from "@/utils/fareNormalization";
import { getDailyIndex } from "@/services/data/mockRepository";
import { toCsv } from "@/utils/csv";

let seq = 0;
const obs = (p: Partial<FareObservation>): FareObservation => ({
  id: `t${++seq}`,
  routeId: "AAA-BBB",
  airlineCode: "6E",
  sourceId: "s",
  observedDate: "2026-01-01",
  travelDate: "2026-01-08",
  advanceDays: 7,
  fare: 1000,
  currency: "INR",
  collectedAt: "2026-01-01T01:00:00Z",
  status: "success",
  ...p,
});

const routes: Route[] = [
  { id: "AAA-BBB", origin: { code: "AAA", name: "A" }, destination: { code: "BBB", name: "B" }, distanceKm: 1, trafficWeight: 0.75 },
  { id: "CCC-DDD", origin: { code: "CCC", name: "C" }, destination: { code: "DDD", name: "D" }, distanceKm: 1, trafficWeight: 0.25 },
];
const base = { from: "2026-01-01", to: "2026-01-01" };

describe("index calculation", () => {
  it("base period equals 100 and follows weighted route relatives", () => {
    const data = [
      obs({ observedDate: "2026-01-01", fare: 1000 }),
      obs({ observedDate: "2026-01-01", routeId: "CCC-DDD", fare: 2000 }),
      obs({ observedDate: "2026-01-02", fare: 1100 }), // AAA-BBB +10%
      obs({ observedDate: "2026-01-02", routeId: "CCC-DDD", fare: 1800 }), // CCC-DDD −10%
    ];
    const daily = computeDailyIndex(data, routes, { basePeriod: base });
    expect(daily[0].value).toBeCloseTo(100);
    // 0.75 × 110 + 0.25 × 90 = 105
    expect(daily[1].value).toBeCloseTo(105);
  });

  it("re-weights over available routes when a route is missing", () => {
    const data = [obs({ fare: 1000 }), obs({ routeId: "CCC-DDD", fare: 2000 }), obs({ observedDate: "2026-01-02", fare: 1200 })];
    expect(computeDailyIndex(data, routes, { basePeriod: base })[1].value).toBeCloseTo(120);
  });

  it("jevons is the geometric mean", () => {
    expect(jevons([1, 4])).toBeCloseTo(2);
  });

  it("aggregates daily to weekly and monthly with period change", () => {
    const daily = [
      { date: "2026-01-05", value: 100, routeRelatives: {}, observationCount: 1 }, // Mon
      { date: "2026-01-06", value: 110, routeRelatives: {}, observationCount: 1 },
      { date: "2026-01-12", value: 121, routeRelatives: {}, observationCount: 1 }, // next Mon
    ];
    const weekly = aggregateIndex(daily, "weekly");
    expect(weekly.map((w) => w.periodStart)).toEqual(["2026-01-05", "2026-01-12"]);
    expect(weekly[0].value).toBeCloseTo(105);
    expect(weekly[1].changePct).toBeCloseTo(((121 - 105) / 105) * 100);
    expect(aggregateIndex(daily, "monthly")).toHaveLength(1);
    expect(percentChange(5, 0)).toBeNull();
  });

  it("demo dataset index starts at ~100 and has 180 daily points", () => {
    const d = getDailyIndex();
    expect(d).toHaveLength(180);
    const baseAvg = d.slice(0, 14).reduce((s, p) => s + p.value, 0) / 14;
    expect(baseAvg).toBeGreaterThan(97);
    expect(baseAvg).toBeLessThan(103);
  });
});

describe("normalisation and route comparison", () => {
  it("drops failures and duplicate captures, keeping the earliest", () => {
    const first = obs({ collectedAt: "2026-01-01T01:00:00Z", fare: 1000 });
    const dup = obs({ collectedAt: "2026-01-01T01:06:00Z", fare: 1010 });
    const failed = obs({ status: "failed", fare: null, advanceDays: 1 });
    const r = normalizeObservations([dup, first, failed]);
    expect(r.clean.map((o) => o.id)).toEqual([first.id]);
    expect(r.stats).toMatchObject({ failed: 1, duplicates: 1 });
  });

  it("filters by city pair, airline and window, then gives low/avg/high", () => {
    const data = [
      obs({ fare: 3000 }),
      obs({ fare: 5000, airlineCode: "AI" }),
      obs({ fare: 9000, advanceDays: 1 }),
      obs({ fare: 4000, routeId: "CCC-DDD" }),
    ];
    const rows = filterObservations(data, { origin: "AAA", destination: "BBB", advanceDays: 7 });
    expect(fareStats(rows)).toEqual({ min: 3000, max: 5000, avg: 4000, count: 2 });
    expect(filterObservations(data, { origin: "AAA", airlineCode: "6E" })).toHaveLength(2);
    expect(fareMatrix(filterObservations(data, { origin: "AAA" }))).toEqual({ "6E": { 7: 3000, 1: 9000 }, AI: { 7: 5000 } });
  });

  it("CSV export escapes commas and quotes", () => {
    const csv = toCsv([{ a: 'x,"y"', b: null }], [
      { header: "a", value: (r) => r.a },
      { header: "b", value: (r) => r.b },
    ]);
    expect(csv).toBe('a,b\n"x,""y""",');
  });
});
