/** Date helpers operating on UTC "YYYY-MM-DD" strings to stay timezone-stable. */

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

/** Monday of the ISO week containing `iso`. */
export function weekStart(iso: string): string {
  const d = parseISODate(iso);
  const day = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -day);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function inRange(iso: string, from?: string, to?: string): boolean {
  return (!from || iso >= from) && (!to || iso <= to);
}
