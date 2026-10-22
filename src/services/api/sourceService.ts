import { appConfig } from "@/config/appConfig";
import type { DataSourceStatus, SourceHealth } from "@/types";
import { SOURCE_DEFINITIONS, generateRawObservations } from "@/services/data/mockData";
import { apiGet, mockResponse } from "./client";

function classify(successRate: number): SourceHealth {
  if (successRate >= 0.95) return "operational";
  if (successRate >= 0.8) return "degraded";
  return "failing";
}

export const sourceService = {
  /** GET /api/v1/sources/status */
  getSourcesStatus(): Promise<DataSourceStatus[]> {
    if (!appConfig.useMockData) return apiGet(appConfig.endpoints.sourcesStatus);
    return mockResponse(() => {
      const raw = generateRawObservations();
      return SOURCE_DEFINITIONS.map((def) => {
        if (!def.configured) {
          return {
            id: def.id,
            name: def.name,
            type: def.type,
            configured: false,
            status: "not_configured" as const,
            lastAttemptAt: null,
            lastSuccessAt: null,
            observationsCollected: 0,
            failedAttempts: 0,
            successRate: null,
            errorSummary: "Not implemented — awaiting source configuration and access approval.",
          };
        }
        const rows = raw.filter((o) => o.sourceId === def.id);
        const ok = rows.filter((o) => o.status === "success");
        const failed = rows.filter((o) => o.status === "failed");
        const errors = new Map<string, number>();
        for (const f of failed) errors.set(f.errorCode!, (errors.get(f.errorCode!) ?? 0) + 1);
        const topErrors = [...errors].sort((a, b) => b[1] - a[1]).slice(0, 2);
        const rate = ok.length / rows.length;
        return {
          id: def.id,
          name: def.name,
          type: def.type,
          configured: true,
          status: classify(rate),
          lastAttemptAt: rows.reduce((m, o) => (o.collectedAt > m ? o.collectedAt : m), ""),
          lastSuccessAt: ok.reduce((m, o) => (o.collectedAt > m ? o.collectedAt : m), ""),
          observationsCollected: ok.length,
          failedAttempts: failed.length,
          successRate: rate,
          errorSummary: topErrors.length ? topErrors.map(([c, n]) => `${c} ×${n}`).join(", ") : null,
        };
      });
    });
  },
};
