import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDb } from '../../src/db/context';
import { useI18n } from '../../src/i18n';
import { relativeTime } from '../../src/i18n/relativeTime';
import { listRecords, type FieldRecord } from '../../src/db/records';
import { ISSUE_SCHEMA } from '../../src/schema/bundled';
import { summaryFor } from '../../src/schema/types';
import { color, radius, shadow, space, TOUCH, type } from '../../src/components/theme';

export default function Issues() {
  const { db } = useDb();
  const { t } = useI18n();
  const router = useRouter();
  const [issues, setIssues] = useState<FieldRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRecords(db, { schemaId: ISSUE_SCHEMA.id }).then((rows) => {
        if (active) setIssues(rows.filter((row) => row.status !== 'draft'));
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <FlatList
      style={styles.flex}
      data={issues}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('issues.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('issues.emptyBody')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const verified = Boolean(item.data.verified_at);
        return (
          <Pressable style={styles.card} onPress={() => router.push(`/issue/${item.id}`)}>
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {summaryFor(ISSUE_SCHEMA, item.data)}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {String(item.data.description ?? '')}
              </Text>
              <Text style={styles.cardTime}>{relativeTime(t, item.updatedAt)}</Text>
            </View>
            <View style={[styles.badge, verified ? styles.badgeOk : styles.badgeOpen]}>
              <Text
                style={[styles.badgeText, { color: verified ? color.synced : color.conflict }]}
              >
                {verified ? t('issues.verified') : t('issues.notVerified')}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

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
  cardMeta: { ...type.help, color: color.inkMuted },
  cardTime: { ...type.meta, color: color.inkFaint },

  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  badgeOk: { backgroundColor: color.syncedBg },
  badgeOpen: { backgroundColor: color.conflictBg },
  badgeText: { ...type.meta },

  empty: { padding: space.xl, gap: space.sm, alignItems: 'center', marginTop: space.xxl },
  emptyTitle: { ...type.label, fontSize: 20, color: color.ink },
  emptyBody: { ...type.body, color: color.inkMuted, textAlign: 'center' },
});
