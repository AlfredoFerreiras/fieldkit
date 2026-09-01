/**
 * Tokens for a tool used one handed, outdoors, sometimes with gloves on,
 * sometimes in a dark mechanical room. Every choice below follows from that.
 *
 * Contrast is high rather than tasteful because the screen competes with
 * direct sun. Touch targets are 56pt rather than the 44pt minimum because a
 * work glove is a blunt instrument. Colour is reserved almost entirely for
 * sync state, so a glance at the list answers the only question that matters:
 * has the office got this yet.
 */

export const color = {
  ink: '#14181D',
  inkMuted: '#5A646E',
  inkFaint: '#8C959E',

  surface: '#FFFFFF',
  canvas: '#F1F3F5',
  line: '#D6DBE0',

  // Sync state. These are load bearing, not decorative.
  draft: '#5A646E',
  queued: '#B26A00',
  synced: '#1B7F4B',
  conflict: '#B3261E',

  focus: '#1F5FD0',
  dangerBg: '#FCEBEA',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const type = {
  // 17 is the floor. Nothing smaller than 13 appears anywhere.
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  section: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.6 },
  label: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  input: { fontSize: 19, fontWeight: '400' as const },
  help: { fontSize: 14, fontWeight: '400' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
} as const;

/** Minimum interactive height. Do not go below this anywhere in the app. */
export const TOUCH = 56;

export const radius = { sm: 6, md: 10 } as const;

export const statusLabel: Record<string, string> = {
  draft: 'Not submitted',
  queued: 'Waiting to send',
  synced: 'Sent',
  conflict: 'Needs your decision',
};

export const statusColor: Record<string, string> = {
  draft: color.draft,
  queued: color.queued,
  synced: color.synced,
  conflict: color.conflict,
};
