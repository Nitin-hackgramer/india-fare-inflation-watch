import type { AdvanceWindow, IndexPeriod } from "@/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const num = new Intl.NumberFormat("en-IN");
const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

export const formatINR = (v: number) => inr.format(v);
export const formatNumber = (v: number) => num.format(v);
export const formatIndex = (v: number) => v.toFixed(2);
export const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));
export const formatShortDate = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));
export const formatDateTime = (iso: string) => `${dateTimeFmt.format(new Date(iso))} IST`;

export function formatPct(v: number | null, digits = 2): string {
  if (v === null || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export const formatWindow = (d: AdvanceWindow) => `T+${d}`;

export function formatPeriodLabel(iso: string, period: IndexPeriod): string {
  if (period === "monthly") return monthFmt.format(new Date(`${iso}T00:00:00Z`));
  if (period === "weekly") return `Wk ${shortDate.format(new Date(`${iso}T00:00:00Z`))}`;
  return shortDate.format(new Date(`${iso}T00:00:00Z`));
}
