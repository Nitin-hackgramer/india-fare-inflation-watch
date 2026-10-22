/** Shared domain types. These mirror the proposed FastAPI response contracts. */

export type AdvanceWindow = 1 | 7 | 15 | 30 | 45;
export type IndexPeriod = "daily" | "weekly" | "monthly";
export type ReportingRange = "30d" | "90d" | "180d";

export interface City {
  code: string;
  name: string;
}

export interface Route {
  id: string; // e.g. "DEL-BOM"
  origin: City;
  destination: City;
  distanceKm: number;
  /** Illustrative basket weight derived from passenger-traffic share (sums to 1). */
  trafficWeight: number;
}

export interface Airline {
  code: string; // IATA code
  name: string;
  sourceId: string;
}

export interface FareObservation {
  id: string;
  routeId: string;
  airlineCode: string;
  sourceId: string;
  observedDate: string; // YYYY-MM-DD (collection date)
  travelDate: string; // YYYY-MM-DD
  advanceDays: AdvanceWindow;
  fare: number | null; // INR, economy, lowest available
  currency: "INR";
  collectedAt: string; // ISO timestamp
  status: "success" | "failed";
  errorCode?: string;
}

export interface IndexObservation {
  periodStart: string; // YYYY-MM-DD
  periodLabel: string;
  value: number;
  changePct: number | null;
  observationCount: number;
}

export interface IndexSnapshot {
  period: IndexPeriod;
  latest: IndexObservation;
  basePeriod: DateRange;
  methodVersion: string;
}

export interface RouteContribution {
  routeId: string;
  weight: number;
  startRelative: number;
  endRelative: number;
  changePct: number;
  contributionPts: number;
}

export interface AirlineSegmentSeries {
  airlineCode: string;
  series: IndexObservation[];
}

export type SourceType = "airline" | "ota";
export type SourceHealth = "operational" | "degraded" | "failing" | "not_configured";

export interface DataSourceStatus {
  id: string;
  name: string;
  type: SourceType;
  configured: boolean;
  status: SourceHealth;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  observationsCollected: number;
  failedAttempts: number;
  successRate: number | null;
  errorSummary: string | null;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface DashboardMetrics {
  currentIndex: number;
  dailyChangePct: number | null;
  weeklyChangePct: number | null;
  monthlyChangePct: number | null;
  routesTracked: number;
  fareObservations: number;
  basePeriod: DateRange;
  reportingRange: DateRange;
  lastUpdated: string;
  health: {
    successful: number;
    failed: number;
    activeSources: number;
    totalSources: number;
    lastCollectionAt: string;
  };
}

export interface FareFilter {
  origin?: string;
  destination?: string;
  airlineCode?: string; // undefined = all
  advanceDays?: AdvanceWindow; // undefined = all
  travelDate?: string;
  from?: string;
  to?: string;
}

export type ShockSeverity = "moderate" | "high" | "severe";

/** A statistically unusual fare move for one route × airline on one collection date. Not a confirmed cause. */
export interface FareShock {
  id: string;
  routeId: string;
  airlineCode: string;
  observedDate: string;
  collectedAt: string; // latest capture among flagged quotes
  direction: "increase" | "decrease";
  changePct: number; // median of flagged quotes vs their rolling median
  robustZ: number; // median robust z-score (signed)
  severity: ShockSeverity;
  windows: AdvanceWindow[]; // advance windows that were flagged
  cellsObserved: number; // windows with enough history that day
  baselineAvgFare: number;
  currentAvgFare: number;
  sampleSize: number; // fares used: flagged quotes + their baseline history
}

export interface ShockScan {
  shocks: FareShock[];
  checked: number; // quotes with enough history to test
  skippedInsufficientHistory: number;
}

/** One index period with the route relatives it was built from. */
export interface PeriodRelatives {
  periodStart: string;
  periodLabel: string;
  value: number;
  routeRelatives: Record<string, number>;
  observationCount: number;
}

/** Same quote (route × airline × window) compared across two periods. */
export interface FareMover {
  routeId: string;
  airlineCode: string;
  advanceDays: AdvanceWindow;
  prevAvg: number | null;
  curAvg: number | null;
  changePct: number | null;
  n: number;
}

export interface IndexExplanation {
  period: IndexPeriod;
  previous: PeriodRelatives;
  current: PeriodRelatives;
  changePts: number;
  changePct: number;
  contributions: RouteContribution[]; // ranked by |contributionPts|
  residualPts: number; // change not attributable to routes present in both periods
  movers: FareMover[];
  latestCollectionAt: string;
  methodVersion: string;
}

export interface CategoryValue {
  key: string;
  label: string;
  value: number;
  count: number;
}
