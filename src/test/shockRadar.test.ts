import { describe, expect, it } from "vitest";
import type { FareObservation } from "@/types";
import type { PeriodRelatives, Route } from "@/types";
import { detectShocks } from "@/utils/shockDetection";
import { aggregateRouteRelatives, aggregateIndex, explainIndexChange, simulateIndex } from "@/utils/indexCalculation";
import { ROUTES } from "@/services/data/mockData";
import { getDailyIndex } from "@/services/data/mockRepository";
import { addDays } from "@/utils/date";
import { DEMO_SHOCK_EVENTS, DEMO_START_DATE } from "@/services/data/mockData";
import { getNormalized } from "@/services/data/mockRepository";

let seq = 0;
const series = (fares: (number | null)[], over: Partial<FareObservation> = {}): FareObservation[] =>
  fares.flatMap((fare, i) =>
    fare === null
      ? []
      : [
          {
            id: `s${++seq}`,
            routeId: "AAA-BBB",
            airlineCode: "6E",
            sourceId: "s",
            observedDate: addDays("2026-01-01", i),
            travelDate: addDays("2026-01-01", i + 7),
            advanceDays: 7,
            fare,
            currency: "INR",
            collectedAt: `${addDays("2026-01-01", i)}T02:00:00Z`,
            status: "success",
            ...over,
          } satisfies FareObservation,
        ],
  );

const flat = [5000, 5100, 4950, 5050, 5000, 4980, 5020, 5060, 4940, 5010];

describe("shock detection", () => {
  it("flags a spike against the rolling median with severity and % change", () => {
    const { shocks } = detectShocks(series([...flat, 6500]));
    expect(shocks).toHaveLength(1);
    const s = shocks[0];
    expect(s.direction).toBe("increase");
    expect(s.changePct).toBeCloseTo((6500 / 5005 - 1) * 100, 0);
    expect(s.severity).toBe("severe");
    expect(s.sampleSize).toBe(11); // 10 baseline fares + the flagged quote
  });

  it("flags drops and ignores ordinary noise", () => {
    expect(detectShocks(series([...flat, 5150])).shocks).toHaveLength(0);
    const { shocks } = detectShocks(series([...flat, 3800]));
    expect(shocks[0].direction).toBe("decrease");
  });

  it("skips quotes with insufficient history instead of guessing", () => {
    const scan = detectShocks(series([5000, 5000, 5000, 9000]));
    expect(scan.shocks).toHaveLength(0);
    expect(scan.skippedInsufficientHistory).toBe(4);
  });

  it("tolerates missing days inside the lookback window", () => {
    const { shocks } = detectShocks(series([5000, null, 5050, 4980, null, 5020, 4990, 5010, 5040, null, 7000]));
    expect(shocks).toHaveLength(1);
  });

  it("groups windows of the same route × airline × date into one alert", () => {
    const a = series([...flat, 6500], { advanceDays: 7 });
    const b = series([...flat, 6600], { advanceDays: 15 });
    const { shocks } = detectShocks([...a, ...b]);
    expect(shocks).toHaveLength(1);
    expect(shocks[0].windows).toEqual([7, 15]);
    expect(shocks[0].cellsObserved).toBe(2);
  });

  it("finds every seeded demo event and nothing else", () => {
    const { shocks } = detectShocks(getNormalized().clean);
    const eventFor = (s: (typeof shocks)[number]) =>
      DEMO_SHOCK_EVENTS.find((e) => {
        const from = addDays(DEMO_START_DATE, e.day);
        const to = addDays(DEMO_START_DATE, e.day + e.days - 1);
        return e.routeId === s.routeId && (!e.airlineCode || e.airlineCode === s.airlineCode) && s.observedDate >= from && s.observedDate <= to;
      });
    const strays = shocks.filter((s) => !eventFor(s)).map((s) => `${s.routeId} ${s.airlineCode} ${s.observedDate} ${s.changePct.toFixed(1)}% z=${s.robustZ.toFixed(1)}`);
    expect(strays).toEqual([]);
    for (const e of DEMO_SHOCK_EVENTS) {
      const day = addDays(DEMO_START_DATE, e.day);
      expect(shocks.some((s) => s.routeId === e.routeId && s.observedDate === day), `${e.routeId} on ${day}`).toBe(true);
    }
  });
});

const routes: Route[] = [
  { id: "A-B", origin: { code: "A", name: "A" }, destination: { code: "B", name: "B" }, distanceKm: 1, trafficWeight: 0.6 },
  { id: "C-D", origin: { code: "C", name: "C" }, destination: { code: "D", name: "D" }, distanceKm: 1, trafficWeight: 0.4 },
];
const pr = (start: string, rel: Record<string, number>, value: number): PeriodRelatives => ({ periodStart: start, periodLabel: start, value, routeRelatives: rel, observationCount: 10 });

describe("explain this change", () => {
  it("contributions are weight × relative change and sum to the index move", () => {
    const prev = pr("d1", { "A-B": 100, "C-D": 100 }, 100);
    const cur = pr("d2", { "A-B": 110, "C-D": 95 }, 0.6 * 110 + 0.4 * 95); // 104
    const { contributions, residualPts } = explainIndexChange(prev, cur, routes);
    expect(contributions.map((c) => c.routeId)).toEqual(["A-B", "C-D"]); // ranked by |pts|
    expect(contributions[0].contributionPts).toBeCloseTo(6);
    expect(contributions[1].contributionPts).toBeCloseTo(-2);
    expect(residualPts).toBeCloseTo(0);
  });

  it("reports a residual when route coverage changes", () => {
    const prev = pr("d1", { "A-B": 100, "C-D": 100 }, 100);
    const cur = pr("d2", { "A-B": 110 }, 110); // C-D missing → re-weighted to A-B only
    const { contributions, residualPts } = explainIndexChange(prev, cur, routes);
    expect(contributions).toHaveLength(1);
    expect(contributions[0].contributionPts + residualPts).toBeCloseTo(10);
  });

  it("explains the seeded DEL-BOM surge with DEL-BOM as top contributor, matching the real index", () => {
    const daily = getDailyIndex();
    const series = aggregateRouteRelatives(daily, "daily", ROUTES);
    const i = series.findIndex((p) => p.periodStart === addDays(DEMO_START_DATE, 173));
    const { contributions, residualPts } = explainIndexChange(series[i - 1], series[i], ROUTES);
    expect(contributions[0].routeId).toBe("DEL-BOM");
    expect(contributions[0].contributionPts).toBeGreaterThan(0);
    expect(series[i].value).toBeCloseTo(daily[i].value, 6); // same number the charts show
    expect(Math.abs(residualPts)).toBeLessThan(1e-9);
    // weekly aggregation agrees with the published weekly index
    const weekly = aggregateRouteRelatives(daily, "weekly", ROUTES);
    const published = aggregateIndex(daily, "weekly");
    expect(weekly.at(-1)!.value).toBeCloseTo(published.at(-1)!.value, 6);
  });
});

describe("what-if simulator", () => {
  const points = [pr("d1", { "A-B": 100, "C-D": 120 }, 108)];

  it("scales the route relative and recomputes the weighted index", () => {
    const [p] = simulateIndex(points, routes, { routeId: "A-B", farePct: 10 });
    expect(p.baseline).toBeCloseTo(108);
    expect(p.routeSimulated).toBeCloseTo(110);
    expect(p.simulated).toBeCloseTo(0.6 * 110 + 0.4 * 120); // 114
  });

  it("re-normalises an overridden weight", () => {
    const [p] = simulateIndex(points, routes, { routeId: "A-B", farePct: 0, weight: 0.4 });
    expect(p.simulated).toBeCloseTo((0.4 * 100 + 0.4 * 120) / 0.8); // 110
  });

  it("zero change reproduces the recorded index and never mutates inputs", () => {
    const before = JSON.stringify(points);
    const [p] = simulateIndex(points, routes, { routeId: "C-D", farePct: 0 });
    expect(p.simulated).toBeCloseTo(p.baseline);
    simulateIndex(points, routes, { routeId: "C-D", farePct: 40, weight: 0.9 });
    expect(JSON.stringify(points)).toBe(before);
  });
});
