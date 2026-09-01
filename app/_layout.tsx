import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import type * as SQLite from 'expo-sqlite';
import { openDatabase } from '../src/db';
import { drain, pendingCount } from '../src/sync/engine';
import { color, space, type } from '../src/components/theme';

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
  if (!ctx) throw new Error('useDb must be used inside the app layout');
  return ctx;
}

export default function RootLayout() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    openDatabase()
      .then(setDb)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function refresh() {
    if (!db) return;
    setPending(await pendingCount(db));
  }

  async function syncNow() {
    if (!db || inFlight.current) return;
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
    if (!db) return;

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

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>The app could not open its local database.</Text>
        <Text style={styles.errorBody}>{error}</Text>
        <Text style={styles.errorBody}>
          Nothing has been lost. Close the app fully and open it again.
        </Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <DbContext.Provider value={{ db, pending, syncing, refresh, syncNow }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.surface },
          headerTitleStyle: { ...type.label },
          headerTintColor: color.ink,
          contentStyle: { backgroundColor: color.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Jobs' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job report' }} />
      </Stack>
    </DbContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: color.canvas,
    gap: space.md,
  },
  errorTitle: { ...type.label, color: color.ink, textAlign: 'center' },
  errorBody: { ...type.body, color: color.inkMuted, textAlign: 'center' },
});
