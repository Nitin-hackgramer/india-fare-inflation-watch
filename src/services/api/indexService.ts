import { appConfig } from "@/config/appConfig";
import type { AirlineSegmentSeries, DateRange, IndexObservation, IndexPeriod, IndexSnapshot, RouteContribution } from "@/types";
import { AIRLINES, BASE_PERIOD, ROUTES } from "@/services/data/mockData";
import { getDailyIndex } from "@/services/data/mockRepository";
import { aggregateIndex, METHOD_VERSION, routeContributions } from "@/utils/indexCalculation";
import { inRange, monthStart, weekStart } from "@/utils/date";
import { apiGet, mockResponse } from "./client";

const startKey = (iso: string, p: IndexPeriod) => (p === "weekly" ? weekStart(iso) : p === "monthly" ? monthStart(iso) : iso);

function sliceSeries(daily: ReturnType<typeof getDailyIndex>, period: IndexPeriod, range?: DateRange): IndexObservation[] {
  const series = aggregateIndex(daily, period);
  if (!range) return series;
  return series.filter((p) => inRange(p.periodStart, startKey(range.from, period), range.to));
}

export const indexService = {
  /** GET /api/v1/index?period=daily */
  getIndex(period: IndexPeriod): Promise<IndexSnapshot> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.index, { period });
    return mockResponse(() => {
      const series = aggregateIndex(getDailyIndex(), period);
      return { period, latest: series[series.length - 1], basePeriod: BASE_PERIOD, methodVersion: METHOD_VERSION };
    });
  },

  /** GET /api/v1/index/history?period=&from=&to=&airline= */
  getIndexHistory(params: { period: IndexPeriod; range?: DateRange; airlineCode?: string }): Promise<IndexObservation[]> {
    if (!appConfig.useMockData)
      return apiGet(appConfig.endpoints.indexHistory, {
        period: params.period,
        from: params.range?.from,
        to: params.range?.to,
        airline: params.airlineCode,
      });
    return mockResponse(() => sliceSeries(getDailyIndex(params.airlineCode), params.period, params.range));
  },

  /** GET /api/v1/index/contributions?from=&to= */
  getRouteContributions(range: DateRange): Promise<RouteContribution[]> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.indexContributions, { ...range });
    return mockResponse(() => routeContributions(getDailyIndex(), ROUTES, range));
  },

  /** GET /api/v1/index/airlines?period=&from=&to= */
  getAirlineSegments(params: { period: IndexPeriod; range: DateRange }): Promise<AirlineSegmentSeries[]> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.indexAirlines, { period: params.period, ...params.range });
    return mockResponse(() =>
      AIRLINES.map((a) => ({ airlineCode: a.code, series: sliceSeries(getDailyIndex(a.code), params.period, params.range) })),
    );
  },
};
