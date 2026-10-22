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

export interface CategoryValue {
  key: string;
  label: string;
  value: number;
  count: number;
}
