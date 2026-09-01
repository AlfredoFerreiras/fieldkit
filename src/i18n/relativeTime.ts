import type { Translate } from './index';

export function relativeTime(t: Translate, ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutes', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hours', { n: hours });
  return t('time.days', { n: Math.floor(hours / 24) });
}
