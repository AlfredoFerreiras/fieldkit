import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDb } from './_layout';
import { createDraft, listRecords, type FieldRecord } from '../src/db/records';
import { summaryFor, type FormSchema } from '../src/schema/types';
import fireRestoration from '../src/schema/examples/fire-restoration.json';
import {
  color,
  radius,
  shadow,
  space,
  statusBg,
  statusColor,
  statusLabel,
  TOUCH,
  type,
} from '../src/components/theme';

// In production this comes from the server and lands in the `schemas` table.
// Bundled here so the app is runnable on first launch with no backend.
const SCHEMA = fireRestoration as FormSchema;

export default function JobList() {
  const { db, pending, syncing, syncNow } = useDb();
  const router = useRouter();
  const [records, setRecords] = useState<FieldRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRecords(db).then((rows) => {
        if (active) setRecords(rows);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  async function startNew() {
    const record = await createDraft(db, SCHEMA, {
      visit_date: new Date().toISOString().slice(0, 10),
    });
    router.push(`/job/${record.id}`);
  }

  return (
    <View style={styles.flex}>
      <SyncBanner pending={pending} syncing={syncing} onPress={syncNow} />

      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No job reports yet</Text>
            <Text style={styles.emptyBody}>
              Start one now. It saves to this phone as you go, so you can finish it with no signal.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/job/${item.id}`)}>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {summaryFor(SCHEMA, item.data)}
              </Text>
              <Text style={styles.cardMeta}>
                {jobNumber(item)}
                {relativeTime(item.updatedAt)}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: statusBg[item.status] }]}>
              <Text style={[styles.pillText, { color: statusColor[item.status] }]}>
                {statusLabel[item.status]}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={startNew}
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>Start job report</Text>
      </Pressable>
    </View>
  );
}

function SyncBanner({
  pending,
  syncing,
  onPress,
}: {
  pending: number;
  syncing: boolean;
  onPress: () => void;
}) {
  if (syncing) {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Sending…</Text>
      </View>
    );
  }
  if (pending === 0) {
    return (
      <View style={styles.banner}>
        <Text style={[styles.bannerText, { color: color.synced }]}>
          Everything is with the office
        </Text>
      </View>
    );
  }
  return (
    <Pressable style={[styles.banner, styles.bannerPending]} onPress={onPress}>
      <Text style={[styles.bannerText, { color: color.surface }]}>
        {pending} waiting to send. Tap to try now.
      </Text>
    </Pressable>
  );
}

function jobNumber(record: FieldRecord): string {
  const jobNo = record.data.job_number;
  return typeof jobNo === 'string' && jobNo !== '' ? `#${jobNo} · ` : '';
}

function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },

  banner: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    backgroundColor: color.canvas,
  },
  bannerPending: { backgroundColor: color.queued, borderBottomColor: color.queued },
  bannerText: { ...type.meta, fontSize: 15, color: color.inkMuted },

  list: { padding: space.lg, gap: space.md, paddingBottom: 120 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH + 16,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.md,
    ...shadow.card,
  },
  cardMain: { flex: 1, gap: 4 },
  cardTitle: { ...type.label, color: color.ink },
  cardMeta: { ...type.meta, color: color.inkFaint },

  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  pillText: { ...type.meta },

  empty: { padding: space.xl, gap: space.sm, alignItems: 'center', marginTop: space.xxl },
  emptyTitle: { ...type.label, fontSize: 20, color: color.ink },
  emptyBody: { ...type.body, color: color.inkMuted, textAlign: 'center' },

  fab: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  fabPressed: { backgroundColor: color.brandPressed },
  fabText: { ...type.label, fontSize: 19, color: color.surface },
});
