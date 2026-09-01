/**
 * Tokens for a tool used one handed, outdoors, sometimes with gloves on,
 * sometimes in a burned-out building with no power. Every choice below follows
 * from that.
 *
 * Contrast is high rather than tasteful because the screen competes with
 * direct sun. Touch targets are 56pt rather than the 44pt minimum because a
 * work glove is a blunt instrument. Status color is load bearing: a glance at
 * the list answers the only question that matters — has the office got this
 * yet. The ember accent is reserved for the one action each screen wants.
 */

export const color = {
  ink: '#1A1D21',
  inkMuted: '#5C6570',
  inkFaint: '#8B949E',

  surface: '#FFFFFF',
  canvas: '#F4F2EF',
  line: '#E3E0DB',

  // Primary action color. One per screen, never for decoration.
  brand: '#C2410C',
  brandPressed: '#9A3412',
  brandTint: '#FFF1EA',

  // Sync state. These are load bearing, not decorative.
  draft: '#5C6570',
  queued: '#B45309',
  synced: '#15803D',
  conflict: '#B91C1C',

  draftBg: '#EEF0F2',
  queuedBg: '#FDF0D5',
  syncedBg: '#DEF5E5',
  conflictBg: '#FDE4E4',

  focus: '#1D4ED8',
  dangerBg: '#FDE4E4',
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
  // 17 is the floor for anything a tech must read at arm's length.
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4 },
  section: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 1.2 },
  label: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  input: { fontSize: 19, fontWeight: '400' as const },
  help: { fontSize: 14, fontWeight: '400' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
} as const;

/** Minimum interactive height. Do not go below this anywhere in the app. */
export const TOUCH = 56;

export const radius = { sm: 8, md: 14, pill: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#1A1D21',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#1A1D21',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

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

export const statusBg: Record<string, string> = {
  draft: color.draftBg,
  queued: color.queuedBg,
  synced: color.syncedBg,
  conflict: color.conflictBg,
};
