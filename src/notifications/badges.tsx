import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { getMeta, setMeta } from '../db';
import { useDb } from '../db/context';
import { useAuth } from '../auth/session';
import { ISSUE_SCHEMA } from '../schema/bundled';

/**
 * Tab bar badge counts. All three answer "what needs a human when they next
 * pick up the phone": chat messages they have not seen, issues nobody has
 * verified, and records stuck waiting for a conflict decision.
 *
 * Counts come straight from SQLite, recomputed when any relevant table
 * changes. The database change listener does the heavy lifting; the app-state
 * hook and slow poll cover platforms or edge cases where it does not fire.
 */

interface BadgeValue {
  unreadChat: number;
  openIssues: number;
  conflicts: number;
  markChatRead: () => Promise<void>;
}

const BadgeContext = createContext<BadgeValue | null>(null);

export function useBadges(): BadgeValue {
  const ctx = useContext(BadgeContext);
  if (!ctx) throw new Error('useBadges must be used inside BadgeProvider');
  return ctx;
}

function chatReadKey(accountId: string): string {
  return `chat_read_${accountId}`;
}

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { db } = useDb();
  const { user } = useAuth();
  const [unreadChat, setUnreadChat] = useState(0);
  const [openIssues, setOpenIssues] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadChat(0);
      setOpenIssues(0);
      setConflicts(0);
      return;
    }

    const lastRead = Number((await getMeta(db, chatReadKey(user.id))) ?? 0);
    const [unread, issueRow, conflictRow] = await Promise.all([
      db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM messages WHERE created_at > ? AND author_id != ?',
        lastRead,
        user.id,
      ),
      db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM records
          WHERE schema_id = ? AND status != 'draft'
            AND json_extract(data, '$.verified_at') IS NULL`,
        ISSUE_SCHEMA.id,
      ),
      db.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM records WHERE status = 'conflict'",
      ),
    ]);
    if (!alive.current) return;

    setUnreadChat(unread?.n ?? 0);
    setOpenIssues(issueRow?.n ?? 0);
    setConflicts(conflictRow?.n ?? 0);
  }, [db, user]);

  const markChatRead = useCallback(async () => {
    if (!user) return;
    await setMeta(db, chatReadKey(user.id), String(Date.now()));
    await refresh();
  }, [db, user, refresh]);

  useEffect(() => {
    alive.current = true;

    // Coalesce bursts of writes (a submit touches records and outbox in one
    // transaction) into a single recount. The first count on mount goes
    // through the same path so it lands after the initial paint.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void refresh();
      }, 250);
    };
    schedule();

    let changeSub: { remove: () => void } | null = null;
    try {
      changeSub = SQLite.addDatabaseChangeListener((event) => {
        if (
          event.tableName === 'messages' ||
          event.tableName === 'records' ||
          event.tableName === 'meta'
        ) {
          schedule();
        }
      });
    } catch {
      // Listener unavailable on this platform; the poll below still refreshes.
    }

    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    const poll = setInterval(() => void refresh(), 30_000);

    return () => {
      alive.current = false;
      changeSub?.remove();
      appSub.remove();
      clearInterval(poll);
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  return (
    <BadgeContext.Provider value={{ unreadChat, openIssues, conflicts, markChatRead }}>
      {children}
    </BadgeContext.Provider>
  );
}

/** Tab badges show nothing at zero and cap the display so wide counts do not
 *  distort the tab bar. */
export function badgeLabel(n: number): number | string | undefined {
  if (n <= 0) return undefined;
  return n > 99 ? '99+' : n;
}
