import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDb } from '../../src/db/context';
import { useAuth } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { relativeTime } from '../../src/i18n/relativeTime';
import { createDraft, listRecords, type FieldRecord } from '../../src/db/records';
import { JOB_SCHEMA } from '../../src/schema/bundled';
import { summaryFor } from '../../src/schema/types';
import { StatusPill } from '../../src/components/StatusPill';
import { SyncBanner } from '../../src/components/SyncBanner';
import { color, radius, shadow, space, TOUCH, type } from '../../src/components/theme';

export default function Jobs() {
  const { db } = useDb();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [records, setRecords] = useState<FieldRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRecords(db, { schemaId: JOB_SCHEMA.id }).then((rows) => {
        if (active) setRecords(rows);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  async function startNew() {
    const record = await createDraft(
      db,
      JOB_SCHEMA,
      { visit_date: new Date().toISOString().slice(0, 10), crew_lead: user?.name ?? '' },
      user?.id ?? null,
    );
    router.push(`/job/${record.id}`);
  }

  return (
    <View style={styles.flex}>
      <SyncBanner />

      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('jobs.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>{t('jobs.emptyBody')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/job/${item.id}`)}>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {summaryFor(JOB_SCHEMA, item.data)}
              </Text>
              <Text style={styles.cardMeta}>
                {jobNumber(item)}
                {relativeTime(t, item.updatedAt)}
              </Text>
            </View>
            <StatusPill status={item.status} />
          </Pressable>
        )}
      />

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + space.lg },
          pressed && styles.fabPressed,
        ]}
        onPress={startNew}
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>{t('home.startJob')}</Text>
      </Pressable>
    </View>
  );
}

function jobNumber(record: FieldRecord): string {
  const jobNo = record.data.job_number;
  return typeof jobNo === 'string' && jobNo !== '' ? `#${jobNo} · ` : '';
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },

  list: { padding: space.lg, gap: space.md, paddingBottom: 140 },

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

  empty: { padding: space.xl, gap: space.sm, alignItems: 'center', marginTop: space.xxl },
  emptyTitle: { ...type.label, fontSize: 20, color: color.ink },
  emptyBody: { ...type.body, color: color.inkMuted, textAlign: 'center' },

  fab: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
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
