import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type * as SQLite from 'expo-sqlite';
import { drain, pendingCount } from '../sync/engine';

interface AppDb {
  db: SQLite.SQLiteDatabase;
  pending: number;
  syncing: boolean;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const DbContext = createContext<AppDb | null>(null);

export function useDb(): AppDb {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error('useDb must be used inside DbProvider');
  return ctx;
}

export function DbProvider({
  db,
  children,
}: {
  db: SQLite.SQLiteDatabase;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  async function refresh() {
    setPending(await pendingCount(db));
  }

  async function syncNow() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSyncing(true);
    try {
      await drain(db);
    } finally {
      inFlight.current = false;
      setSyncing(false);
      setPending(await pendingCount(db));
    }
  }

  // Three triggers, all cheap: connectivity returning, the app coming to the
  // foreground, and a slow poll for the case where the phone thinks it is
  // online but the captive portal disagrees.
  useEffect(() => {
    void syncNow();

    const netSub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncNow();
    });

    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow();
    });

    const poll = setInterval(() => void syncNow(), 60_000);

    return () => {
      netSub();
      appSub.remove();
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  return (
    <DbContext.Provider value={{ db, pending, syncing, refresh, syncNow }}>
      {children}
    </DbContext.Provider>
  );
}
