/**
 * DEMO DATA — deterministic, seeded simulation of fare collection.
 * Nothing here is scraped or sourced from airlines, OTAs, CPI or MoSPI.
 * Every page derives its numbers from `generateRawObservations()`.
 */
import type { AdvanceWindow, Airline, City, FareObservation, Route, SourceType } from "@/types";
import { addDays } from "@/utils/date";

export const DEMO_END_DATE = "2026-10-21";
export const DEMO_DAYS = 180;
export const DEMO_START_DATE = addDays(DEMO_END_DATE, -(DEMO_DAYS - 1));
export const BASE_PERIOD_DAYS = 14;
export const BASE_PERIOD = {
  from: DEMO_START_DATE,
  to: addDays(DEMO_START_DATE, BASE_PERIOD_DAYS - 1),
};

const city = (code: string, name: string): City => ({ code, name });
export const CITIES: Record<string, City> = {
  DEL: city("DEL", "Delhi"),
  BOM: city("BOM", "Mumbai"),
  BLR: city("BLR", "Bengaluru"),
  CCU: city("CCU", "Kolkata"),
  HYD: city("HYD", "Hyderabad"),
  MAA: city("MAA", "Chennai"),
};

/** Illustrative weights approximating relative passenger traffic. */
export const ROUTES: Route[] = [
  { id: "DEL-BOM", origin: CITIES.DEL, destination: CITIES.BOM, distanceKm: 1148, trafficWeight: 0.26 },
  { id: "DEL-BLR", origin: CITIES.DEL, destination: CITIES.BLR, distanceKm: 1740, trafficWeight: 0.21 },
  { id: "BOM-BLR", origin: CITIES.BOM, destination: CITIES.BLR, distanceKm: 842, trafficWeight: 0.17 },
  { id: "DEL-CCU", origin: CITIES.DEL, destination: CITIES.CCU, distanceKm: 1305, trafficWeight: 0.12 },
  { id: "BLR-HYD", origin: CITIES.BLR, destination: CITIES.HYD, distanceKm: 500, trafficWeight: 0.11 },
  { id: "MAA-DEL", origin: CITIES.MAA, destination: CITIES.DEL, distanceKm: 1760, trafficWeight: 0.13 },
];

const ROUTE_BASE_FARE: Record<string, number> = {
  "DEL-BOM": 5400,
  "DEL-BLR": 6200,
  "BOM-BLR": 4300,
  "DEL-CCU": 5600,
  "BLR-HYD": 3200,
  "MAA-DEL": 6500,
};

export const AIRLINES: Airline[] = [
  { code: "6E", name: "IndiGo", sourceId: "src-indigo" },
  { code: "AI", name: "Air India", sourceId: "src-airindia" },
  { code: "IX", name: "Air India Express", sourceId: "src-aix" },
  { code: "QP", name: "Akasa Air", sourceId: "src-akasa" },
  { code: "SG", name: "SpiceJet", sourceId: "src-spicejet" },
];

const AIRLINE_FACTOR: Record<string, number> = { "6E": 1, AI: 1.12, IX: 0.93, QP: 0.97, SG: 0.95 };

export const ADVANCE_WINDOWS: AdvanceWindow[] = [1, 7, 15, 30, 45];
const WINDOW_FACTOR: Record<AdvanceWindow, number> = { 1: 1.58, 7: 1.21, 15: 1.0, 30: 0.9, 45: 0.85 };

export interface SourceDefinition {
  id: string;
  name: string;
  type: SourceType;
  configured: boolean;
  failureRate: number;
}

export const SOURCE_DEFINITIONS: SourceDefinition[] = [
  { id: "src-indigo", name: "IndiGo — airline website", type: "airline", configured: true, failureRate: 0.022 },
  { id: "src-airindia", name: "Air India — airline website", type: "airline", configured: true, failureRate: 0.03 },
  { id: "src-aix", name: "Air India Express — airline website", type: "airline", configured: true, failureRate: 0.045 },
  { id: "src-akasa", name: "Akasa Air — airline website", type: "airline", configured: true, failureRate: 0.028 },
  { id: "src-spicejet", name: "SpiceJet — airline website", type: "airline", configured: true, failureRate: 0.14 },
  { id: "src-ota-a", name: "OTA source A (placeholder)", type: "ota", configured: false, failureRate: 0 },
  { id: "src-ota-b", name: "OTA source B (placeholder)", type: "ota", configured: false, failureRate: 0 },
];

/**
 * Deterministic DEMO fare shocks so the Shock Radar has examples in every presentation.
 * `day` is the index into the 180-day window; `factor` multiplies the simulated fare.
 * These are invented scenarios, not real-world events.
 */
export const DEMO_SHOCK_EVENTS: { routeId: string; airlineCode?: string; day: number; days: number; factor: number }[] = [
  { routeId: "DEL-BOM", day: 173, days: 2, factor: 1.24 }, // route-wide surge, visibly moves the index
  { routeId: "MAA-DEL", airlineCode: "QP", day: 177, days: 1, factor: 1.3 },
  { routeId: "BLR-HYD", airlineCode: "SG", day: 166, days: 1, factor: 0.7 }, // flash-sale style drop
  { routeId: "DEL-CCU", airlineCode: "IX", day: 151, days: 1, factor: 0.74 },
  { routeId: "BOM-BLR", airlineCode: "6E", day: 118, days: 1, factor: 1.32 },
];

function shockFactor(routeId: string, airlineCode: string, day: number): number {
  const e = DEMO_SHOCK_EVENTS.find((s) => s.routeId === routeId && (!s.airlineCode || s.airlineCode === airlineCode) && day >= s.day && day < s.day + s.days);
  return e?.factor ?? 1;
}

const ERROR_CODES =["TIMEOUT", "HTTP_503", "PARSE_ERROR", "NO_FARES_LISTED"];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seasonalFactor(dayIndex: number, iso: string): number {
  const cycle = 0.06 * Math.sin((dayIndex / (DEMO_DAYS - 1)) * Math.PI * 2 + 1.3);
  const drift = 0.0004 * dayIndex;
  const festive = dayIndex > 150 ? 0.0035 * (dayIndex - 150) : 0;
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 5 || weekday === 0 ? 0.035 : 0;
  return 1 + cycle + drift + festive + weekend;
}

let cache: FareObservation[] | null = null;

export function generateRawObservations(): FareObservation[] {
  if (cache) return cache;
  const rand = mulberry32(26056);
  const out: FareObservation[] = [];
  let seq = 0;

  for (let d = 0; d < DEMO_DAYS; d++) {
    const observedDate = addDays(DEMO_START_DATE, d);
    const season = seasonalFactor(d, observedDate);
    for (const route of ROUTES) {
      for (const airline of AIRLINES) {
        const source = SOURCE_DEFINITIONS.find((s) => s.id === airline.sourceId)!;
        for (const w of ADVANCE_WINDOWS) {
          const minutes = 30 + Math.floor(rand() * 300);
          const collectedAt = new Date(
            Date.parse(`${observedDate}T00:00:00Z`) + minutes * 60_000,
          ).toISOString();
          const failed = rand() < source.failureRate;
          const noise = 1 + (rand() - 0.5) * 0.12;
          let fare = ROUTE_BASE_FARE[route.id] * AIRLINE_FACTOR[airline.code] * WINDOW_FACTOR[w] * season * noise * shockFactor(route.id, airline.code, d);
          if (rand() < 0.002) fare *= 3.2; // injected outlier
          const obs: FareObservation = {
            id: `obs-${++seq}`,
            routeId: route.id,
            airlineCode: airline.code,
            sourceId: airline.sourceId,
            observedDate,
            travelDate: addDays(observedDate, w),
            advanceDays: w,
            fare: failed ? null : Math.round(fare / 10) * 10 - 1,
            currency: "INR",
            collectedAt,
            status: failed ? "failed" : "success",
            errorCode: failed ? ERROR_CODES[Math.floor(rand() * ERROR_CODES.length)] : undefined,
          };
          out.push(obs);
          if (!failed && rand() < 0.01) {
            // injected duplicate capture (re-collected 6 minutes later)
            out.push({
              ...obs,
              id: `obs-${++seq}`,
              collectedAt: new Date(Date.parse(collectedAt) + 360_000).toISOString(),
            });
          }
        }
      }
    }
  }
  cache = out;
  return out;
}

export const routeById = (id: string) => ROUTES.find((r) => r.id === id);
export const airlineByCode = (code: string) => AIRLINES.find((a) => a.code === code);
export const routeLabel = (id: string) => id.replace("-", "–");
