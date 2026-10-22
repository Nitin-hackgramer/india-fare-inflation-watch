/** React Query wrappers — pages consume these, never the services directly. */
import { useQuery } from "@tanstack/react-query";
import type { DateRange, FareFilter, IndexPeriod, ReportingRange } from "@/types";
import { airfareService } from "@/services/api/airfareService";
import { indexService } from "@/services/api/indexService";
import { sourceService } from "@/services/api/sourceService";
import { usePreferences } from "./usePreferences";

const STALE = 60_000;

export function useDashboardSummary(range: ReportingRange) {
  const { prefs } = usePreferences();
  return useQuery({
    queryKey: ["dashboard", range],
    queryFn: () => airfareService.getDashboardSummary(range),
    staleTime: STALE,
    refetchInterval: prefs.refreshIntervalMin > 0 ? prefs.refreshIntervalMin * 60_000 : false,
  });
}

export const useFareComparisons = (range: ReportingRange) =>
  useQuery({ queryKey: ["comparisons", range], queryFn: () => airfareService.getComparisons(range), staleTime: STALE });

export const useRecentObservations = (limit = 50) =>
  useQuery({ queryKey: ["recent", limit], queryFn: () => airfareService.getRecentObservations(limit), staleTime: STALE });

export const useFares = (filter: FareFilter, enabled = true) =>
  useQuery({ queryKey: ["fares", filter], queryFn: () => airfareService.getFares(filter), staleTime: STALE, enabled });

export const useIndexHistory = (period: IndexPeriod, range?: DateRange, airlineCode?: string) =>
  useQuery({
    queryKey: ["index-history", period, range, airlineCode],
    queryFn: () => indexService.getIndexHistory({ period, range, airlineCode }),
    staleTime: STALE,
  });

export const useIndexSnapshot = (period: IndexPeriod) =>
  useQuery({ queryKey: ["index", period], queryFn: () => indexService.getIndex(period), staleTime: STALE });

export const useRouteContributions = (range: DateRange) =>
  useQuery({ queryKey: ["contributions", range], queryFn: () => indexService.getRouteContributions(range), staleTime: STALE });

export const useAirlineSegments = (period: IndexPeriod, range: DateRange) =>
  useQuery({
    queryKey: ["airline-segments", period, range],
    queryFn: () => indexService.getAirlineSegments({ period, range }),
    staleTime: STALE,
  });

export const useSourcesStatus = () =>
  useQuery({ queryKey: ["sources"], queryFn: () => sourceService.getSourcesStatus(), staleTime: STALE });
