import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RecordStatus } from '../db/records';
import { useI18n } from '../i18n';
import { radius, space, statusBg, statusColor, type } from './theme';

export function StatusPill({ status }: { status: RecordStatus }) {
  const { t } = useI18n();
  return (
    <View style={[styles.pill, { backgroundColor: statusBg[status] }]}>
      <Text style={[styles.text, { color: statusColor[status] }]}>{t(`status.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  text: { ...type.meta },
});
