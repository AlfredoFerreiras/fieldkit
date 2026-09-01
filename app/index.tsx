import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDb } from './_layout';
import { createDraft, listRecords, type FieldRecord } from '../src/db/records';
import type { FormSchema } from '../src/schema/types';
import hvac from '../src/schema/examples/hvac-inspection.json';
import {
  color,
  radius,
  space,
  statusColor,
  statusLabel,
  TOUCH,
  type,
} from '../src/components/theme';

// In production this comes from the server and lands in the `schemas` table.
// Bundled here so the app is runnable on first launch with no backend.
const SCHEMA = hvac as FormSchema;

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
      inspected_on: new Date().toISOString().slice(0, 10),
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
            <Text style={styles.emptyTitle}>No inspections yet</Text>
            <Text style={styles.emptyBody}>
              Start one now. It saves to this phone as you go, so you can finish it with no signal.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/job/${item.id}`)}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {summarize(item)}
              </Text>
              <Text style={styles.rowMeta}>{relativeTime(item.updatedAt)}</Text>
            </View>
            <View style={[styles.pip, { backgroundColor: statusColor[item.status] }]} />
            <Text style={[styles.rowStatus, { color: statusColor[item.status] }]}>
              {statusLabel[item.status]}
            </Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={startNew} accessibilityRole="button">
        <Text style={styles.fabText}>Start inspection</Text>
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
      <View style={[styles.banner, { backgroundColor: color.canvas }]}>
        <Text style={styles.bannerText}>Sending…</Text>
      </View>
    );
  }
  if (pending === 0) {
    return (
      <View style={[styles.banner, { backgroundColor: color.canvas }]}>
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

function summarize(record: FieldRecord): string {
  const site = record.data.site_name as string | undefined;
  const unit = record.data.unit_id as string | undefined;
  if (site && unit) return `${site} · Unit ${unit}`;
  if (site) return site;
  return 'Untitled inspection';
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
  },
  bannerPending: { backgroundColor: color.queued, borderBottomColor: color.queued },
  bannerText: { ...type.meta, fontSize: 15, color: color.inkMuted },

  list: { padding: space.lg, gap: space.sm, paddingBottom: 120 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH + 12,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { ...type.label, color: color.ink },
  rowMeta: { ...type.meta, color: color.inkFaint },
  pip: { width: 8, height: 8, borderRadius: 4 },
  rowStatus: { ...type.meta },

  empty: { padding: space.xl, gap: space.sm, alignItems: 'center' },
  emptyTitle: { ...type.label, fontSize: 20, color: color.ink },
  emptyBody: { ...type.body, color: color.inkMuted, textAlign: 'center' },

  fab: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { ...type.label, fontSize: 19, color: color.surface },
});
