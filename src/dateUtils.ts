const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function toDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseLocal(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** [start, end) of a local day as ISO strings, for comparing with stored eaten_at. */
export function dayRangeISO(dateString: string): [string, string] {
  const start = parseLocal(dateString);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return [start.toISOString(), end.toISOString()];
}

export function shiftDate(dateString: string, days: number): string {
  const d = parseLocal(dateString);
  return toDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** The last `n` local dates ending today, oldest first. */
export function lastNDates(n: number): string[] {
  const today = toDateString();
  return Array.from({ length: n }, (_, i) => shiftDate(today, i - (n - 1)));
}

export interface DayLabels {
  today: string;
  yesterday: string;
  tomorrow: string;
}

export function dayLabel(dateString: string, labels: DayLabels, locale: string): string {
  const today = toDateString();
  if (dateString === today) return labels.today;
  if (dateString === shiftDate(today, -1)) return labels.yesterday;
  if (dateString === shiftDate(today, 1)) return labels.tomorrow;
  return parseLocal(dateString).toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
