import { appConfig } from "@/config/appConfig";
import type { AirlineSegmentSeries, DateRange, IndexExplanation, IndexObservation, IndexPeriod, IndexSnapshot, PeriodRelatives, RouteContribution } from "@/types";
import { AIRLINES, BASE_PERIOD, ROUTES } from "@/services/data/mockData";
import { getDailyIndex, getNormalized } from "@/services/data/mockRepository";
import { aggregateIndex, aggregateRouteRelatives, explainIndexChange, METHOD_VERSION, periodKey, routeContributions } from "@/utils/indexCalculation";
import { compareFares } from "@/utils/fareFilters";
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

  /** GET /api/v1/index/route-relatives?period=&from=&to= — per-period route relatives (what-if simulator input). */
  getRouteRelatives(params: { period: IndexPeriod; range: DateRange }): Promise<PeriodRelatives[]> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.indexRouteRelatives, { period: params.period, ...params.range });
    return mockResponse(() =>
      aggregateRouteRelatives(getDailyIndex(), params.period, ROUTES).filter((p) => inRange(p.periodStart, startKey(params.range.from, params.period), params.range.to)),
    );
  },

  /** GET /api/v1/index/explain?period=&period_start= — null when there is no earlier period to compare. */
  explainChange(params: { period: IndexPeriod; periodStart: string }): Promise<IndexExplanation | null> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.indexExplain, { period: params.period, period_start: params.periodStart });
    return mockResponse(() => {
      const series = aggregateRouteRelatives(getDailyIndex(), params.period, ROUTES);
      const i = series.findIndex((p) => p.periodStart === params.periodStart);
      if (i < 1) return null;
      const previous = series[i - 1];
      const current = series[i];
      const { contributions, residualPts } = explainIndexChange(previous, current, ROUTES);
      const clean = getNormalized().clean;
      const inPeriod = (start: string) => clean.filter((o) => periodKey(o.observedDate, params.period) === start);
      const cur = inPeriod(current.periodStart);
      return {
        period: params.period,
        previous,
        current,
        changePts: current.value - previous.value,
        changePct: ((current.value - previous.value) / previous.value) * 100,
        contributions,
        residualPts,
        movers: compareFares(inPeriod(previous.periodStart), cur),
        latestCollectionAt: cur.reduce((m, o) => (o.collectedAt > m ? o.collectedAt : m), ""),
        methodVersion: METHOD_VERSION,
      };
    });
  },

  /** GET /api/v1/index/airlines?period=&from=&to= */
  getAirlineSegments(params: { period: IndexPeriod; range: DateRange }): Promise<AirlineSegmentSeries[]> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.indexAirlines, { period: params.period, ...params.range });
    return mockResponse(() =>
      AIRLINES.map((a) => ({ airlineCode: a.code, series: sliceSeries(getDailyIndex(a.code), params.period, params.range) })),
    );
  },
};
