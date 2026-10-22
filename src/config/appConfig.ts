/**
 * Central runtime configuration. All backend endpoints live here so the
 * FastAPI contract can change without touching pages or components.
 */
const env = import.meta.env;
const apiBaseUrl = ((env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "");

export const appConfig = {
  appName: "Airfare Index India",
  /** FastAPI base URL (e.g. https://airfare-index-api.onrender.com). Empty = mock mode. */
  apiBaseUrl,
  /** Mock data is used unless an API URL is set AND VITE_USE_MOCK_DATA=false. */
  useMockData: !apiBaseUrl || env.VITE_USE_MOCK_DATA !== "false",
  mockLatencyMs: 220,
  timezone: "Asia/Kolkata",
  endpoints: {
    dashboardSummary: "/api/v1/dashboard/summary",
    index: "/api/v1/index",
    indexHistory: "/api/v1/index/history",
    indexContributions: "/api/v1/index/contributions",
    indexAirlines: "/api/v1/index/airlines",
    indexExplain: "/api/v1/index/explain",
    indexRouteRelatives: "/api/v1/index/route-relatives",
    shocks: "/api/v1/shocks",
    fares: "/api/v1/fares",
    sourcesStatus: "/api/v1/sources/status",
    health: "/api/v1/health",
  },
  supabase: {
    url: (env.VITE_SUPABASE_URL as string | undefined) ?? "",
    publishableKey: (env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "",
  },
} as const;
