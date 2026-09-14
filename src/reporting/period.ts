import type { MessageKey } from '../i18n';

/**
 * Time windows shared by the Reports and Dashboard screens, so the two views
 * of the same records can never drift on what "last 30 days" means.
 */

export type Period = 'last7' | 'last30' | 'all';

export const PERIODS: { key: Period; label: MessageKey }[] = [
  { key: 'last7', label: 'reports.last7' },
  { key: 'last30', label: 'reports.last30' },
  { key: 'all', label: 'reports.all' },
];

export const DAY = 24 * 60 * 60 * 1000;

/** Epoch-ms cutoff for a period; 0 means "all time". */
export function periodStart(period: Period): number {
  if (period === 'last7') return Date.now() - 7 * DAY;
  if (period === 'last30') return Date.now() - 30 * DAY;
  return 0;
}

/** Monday 00:00 of the week containing t, in local time. */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
