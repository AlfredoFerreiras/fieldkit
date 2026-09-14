import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDb } from '../db/context';
import { useI18n } from '../i18n';
import { color, space, type } from './theme';

/**
 * One line that answers "has the office got everything yet". Rendered at the
 * top of any screen where that question matters; tapping it retries now
 * instead of waiting for the next trigger.
 */
export function SyncBanner() {
  const { pending, syncing, syncNow } = useDb();
  const { t } = useI18n();

  if (syncing) {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerText}>{t('sync.sending')}</Text>
      </View>
    );
  }
  if (pending === 0) {
    return (
      <View style={styles.banner}>
        <Text style={[styles.bannerText, { color: color.synced }]}>{t('sync.allSent')}</Text>
      </View>
    );
  }
  return (
    <Pressable style={[styles.banner, styles.bannerPending]} onPress={() => void syncNow()}>
      <Text style={[styles.bannerText, { color: color.surface }]}>
        {t('sync.pending', { n: pending })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    backgroundColor: color.canvas,
  },
  bannerPending: { backgroundColor: color.queued, borderBottomColor: color.queued },
  bannerText: { ...type.meta, fontSize: 15, color: color.inkMuted },
});
