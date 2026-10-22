import { appConfig } from "@/config/appConfig";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

type Params = Record<string, string | number | undefined>;

/** Single entry point for all FastAPI GET requests. */
export async function apiGet<T>(path: string, params?: Params): Promise<T> {
  if (!appConfig.apiBaseUrl) throw new ApiError("API base URL is not configured");
  const url = new URL(appConfig.apiBaseUrl + path);
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
  return (await res.json()) as T;
}

/** Wraps a synchronous mock computation in a promise with realistic latency. */
export function mockResponse<T>(compute: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(compute());
      } catch (e) {
        reject(e);
      }
    }, appConfig.mockLatencyMs),
  );
}

export async function checkBackendHealth(): Promise<{ ok: boolean; message: string }> {
  if (!appConfig.apiBaseUrl) return { ok: false, message: "No API base URL configured (VITE_API_BASE_URL)." };
  try {
    await apiGet(appConfig.endpoints.health);
    return { ok: true, message: "Backend responded successfully." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Backend unreachable." };
  }
}
