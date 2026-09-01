import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import type * as SQLite from 'expo-sqlite';
import { openDatabase } from '../src/db';
import { DbProvider } from '../src/db/context';
import { AuthProvider, useAuth } from '../src/auth/session';
import { LocaleProvider } from '../src/i18n';
import { color, space, type } from '../src/components/theme';

export default function RootLayout() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openDatabase()
      .then(setDb)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

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
    <DbProvider db={db}>
      <LocaleProvider db={db}>
        <AuthProvider db={db}>
          <AuthGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: color.surface },
                headerTitleStyle: { ...type.label },
                headerTintColor: color.ink,
                contentStyle: { backgroundColor: color.canvas },
              }}
            >
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </LocaleProvider>
    </DbProvider>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const atLogin = segments[0] === 'login';
    if (!user && !atLogin) {
      router.replace('/login');
    } else if (user && atLogin) {
      router.replace('/');
    }
  }, [user, ready, segments, router]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return <>{children}</>;
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
