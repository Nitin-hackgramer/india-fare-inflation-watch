import { appConfig } from "@/config/appConfig";
import type { CategoryValue, DashboardMetrics, FareFilter, FareObservation, ReportingRange } from "@/types";
import { AIRLINES, BASE_PERIOD, ROUTES, SOURCE_DEFINITIONS, airlineByCode, generateRawObservations, routeLabel } from "@/services/data/mockData";
import { getDailyIndex, getNormalized, rangeToDates } from "@/services/data/mockRepository";
import { averageBy, filterObservations } from "@/utils/fareFilters";
import { changeOverDays } from "@/utils/indexCalculation";
import { inRange } from "@/utils/date";
import { formatWindow } from "@/utils/format";
import { apiGet, mockResponse } from "./client";

export interface FareComparisons {
  byRoute: CategoryValue[];
  byAirline: CategoryValue[];
  byWindow: CategoryValue[];
}

export const airfareService = {
  /** GET /api/v1/dashboard/summary?range= */
  getDashboardSummary(range: ReportingRange): Promise<DashboardMetrics> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.dashboardSummary, { range });
    return mockResponse(() => {
      const dates = rangeToDates(range);
      const daily = getDailyIndex();
      const raw = generateRawObservations().filter((o) => inRange(o.observedDate, dates.from, dates.to));
      const clean = getNormalized().clean.filter((o) => inRange(o.observedDate, dates.from, dates.to));
      const lastCollectionAt = raw.reduce((m, o) => (o.collectedAt > m ? o.collectedAt : m), "");
      const successful = raw.filter((o) => o.status === "success").length;
      return {
        currentIndex: daily[daily.length - 1].value,
        dailyChangePct: changeOverDays(daily, 1),
        weeklyChangePct: changeOverDays(daily, 7),
        monthlyChangePct: changeOverDays(daily, 30),
        routesTracked: ROUTES.length,
        fareObservations: clean.length,
        basePeriod: BASE_PERIOD,
        reportingRange: dates,
        lastUpdated: lastCollectionAt,
        health: {
          successful,
          failed: raw.length - successful,
          activeSources: new Set(raw.filter((o) => o.status === "success").map((o) => o.sourceId)).size,
          totalSources: SOURCE_DEFINITIONS.length,
          lastCollectionAt,
        },
      };
    });
  },

  /** GET /api/v1/fares?origin=&destination=&airline=&window=&travel_date=&from=&to= */
  getFares(filter: FareFilter): Promise<FareObservation[]> {
    if (!appConfig.useMockData)
      return apiGet(appConfig.endpoints.fares, {
        origin: filter.origin,
        destination: filter.destination,
        airline: filter.airlineCode,
        window: filter.advanceDays,
        travel_date: filter.travelDate,
        from: filter.from,
        to: filter.to,
      });
    return mockResponse(() => filterObservations(getNormalized().clean, filter));
  },

  /** Derived comparisons for the overview. Backend: GET /api/v1/fares/comparisons?range= */
  getComparisons(range: ReportingRange): Promise<FareComparisons> {
    if (!appConfig.useMockData) return apiGet(`${appConfig.endpoints.fares}/comparisons`, { range });
    return mockResponse(() => {
      const obs = filterObservations(getNormalized().clean, rangeToDates(range));
      const order = (keys: string[]) => (a: CategoryValue, b: CategoryValue) => keys.indexOf(a.key) - keys.indexOf(b.key);
      return {
        byRoute: averageBy(obs, (o) => o.routeId, routeLabel).sort((a, b) => b.value - a.value),
        byAirline: averageBy(obs, (o) => o.airlineCode, (k) => airlineByCode(k)?.name ?? k).sort(order(AIRLINES.map((a) => a.code))),
        byWindow: averageBy(obs, (o) => String(o.advanceDays), (k) => formatWindow(Number(k) as 1)).sort(
          (a, b) => Number(a.key) - Number(b.key),
        ),
      };
    });
  },

  /** GET /api/v1/fares/recent?limit= */
  getRecentObservations(limit = 50): Promise<FareObservation[]> {
    if (!appConfig.useMockData) return apiGet(`${appConfig.endpoints.fares}/recent`, { limit });
    return mockResponse(() => [...getNormalized().clean].reverse().slice(0, limit));
  },
};
