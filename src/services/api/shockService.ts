import { appConfig } from "@/config/appConfig";
import type { DateRange, ShockScan } from "@/types";
import { getShockScan } from "@/services/data/mockRepository";
import { inRange } from "@/utils/date";
import { apiGet, mockResponse } from "./client";

export const shockService = {
  /** GET /api/v1/shocks?from=&to= */
  getShocks(range: DateRange): Promise<ShockScan> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.shocks, { ...range });
    return mockResponse(() => {
      const scan = getShockScan();
      return { ...scan, shocks: scan.shocks.filter((s) => inRange(s.observedDate, range.from, range.to)) };
    });
  },
};
