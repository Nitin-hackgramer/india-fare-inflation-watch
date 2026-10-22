import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { IndexPeriod, ReportingRange } from "@/types";

export interface Preferences {
  currency: "INR";
  defaultRange: ReportingRange;
  indexView: IndexPeriod;
  showGrid: boolean;
  showDataPoints: boolean;
  /** Minutes between automatic data refreshes; 0 = manual. */
  refreshIntervalMin: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  currency: "INR",
  defaultRange: "90d",
  indexView: "daily",
  showGrid: true,
  showDataPoints: false,
  refreshIntervalMin: 0,
};

const STORAGE_KEY = "aii.preferences.v1";

interface Ctx {
  prefs: Preferences;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  resetPrefs: () => void;
  range: ReportingRange;
  setRange: (r: ReportingRange) => void;
}

const PreferencesContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [range, setRange] = useState<ReportingRange>(DEFAULT_PREFERENCES.defaultRange);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const p = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } as Preferences;
        setPrefs(p);
        setRange(p.defaultRange);
      }
    } catch {
      /* ignore corrupt storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs, loaded]);

  const setPref = useCallback<Ctx["setPref"]>((key, value) => setPrefs((p) => ({ ...p, [key]: value })), []);
  const resetPrefs = useCallback(() => setPrefs(DEFAULT_PREFERENCES), []);

  const value = useMemo(() => ({ prefs, setPref, resetPrefs, range, setRange }), [prefs, setPref, resetPrefs, range]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Ctx {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
