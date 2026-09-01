import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useDb } from '../../src/db/context';
import { useI18n } from '../../src/i18n';
import { getRecord, saveDraft, submit, type FieldRecord } from '../../src/db/records';
import { resolveKeepLocal, resolveKeepServer } from '../../src/sync/engine';
import { FormRenderer } from '../../src/components/FormRenderer';
import { JOB_SCHEMA } from '../../src/schema/bundled';
import type { FormValues } from '../../src/schema/types';
import { color, radius, space, TOUCH, type } from '../../src/components/theme';

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, syncNow, refresh } = useDb();
  const { t } = useI18n();
  const router = useRouter();
  const [record, setRecord] = useState<FieldRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getRecord(db, id).then((r) => {
      setRecord(r);
      setLoading(false);
    });
  }, [db, id]);

  const title = t('tabs.jobs');

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        <ActivityIndicator />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title }} />
        <Text style={styles.title}>{t('job.gone')}</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t('job.back')}</Text>
        </Pressable>
      </View>
    );
  }

  async function handleSubmit(values: FormValues) {
    await submit(db, JOB_SCHEMA, record!.id, values);
    await refresh();
    void syncNow();
    router.back();
    Alert.alert(t('job.submittedTitle'), t('job.submittedBody'));
  }

  if (record.status === 'conflict') {
    return (
      <ConflictScreen
        record={record}
        onKeepLocal={async () => {
          await resolveKeepLocal(db, record.id);
          await refresh();
          void syncNow();
          router.back();
        }}
        onKeepServer={async () => {
          await resolveKeepServer(db, record.id);
          await refresh();
          router.back();
        }}
      />
    );
  }

  const readOnly = record.status === 'queued' || record.status === 'synced';

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title }} />
      {readOnly ? (
        <View style={styles.lockBanner}>
          <Text style={styles.lockText}>{t('job.readOnly')}</Text>
        </View>
      ) : null}

      <FormRenderer
        schema={JOB_SCHEMA}
        initialValues={record.data}
        submitLabel={t('job.submit')}
        onAutosave={(values) => void saveDraft(db, record.id, values)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

function ConflictScreen({
  record,
  onKeepLocal,
  onKeepServer,
}: {
  record: FieldRecord;
  onKeepLocal: () => void;
  onKeepServer: () => void;
}) {
  const { t } = useI18n();
  const differing = Object.keys({ ...record.data, ...(record.conflictData ?? {}) }).filter(
    (key) => JSON.stringify(record.data[key]) !== JSON.stringify((record.conflictData ?? {})[key]),
  );

  function render(value: unknown): string {
    if (value === undefined || value === null || value === '') return t('conflict.blank');
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
    return String(value);
  }

  return (
    <View style={styles.conflictWrap}>
      <Stack.Screen options={{ title: t('tabs.jobs') }} />
      <Text style={styles.title}>{t('conflict.title')}</Text>
      <Text style={styles.body}>{t('conflict.body')}</Text>

      <View style={styles.diffList}>
        {differing.map((key) => (
          <View key={key} style={styles.diffRow}>
            <Text style={styles.diffField}>{key}</Text>
            <Text style={styles.diffMine}>
              {t('conflict.yours', { value: render(record.data[key]) })}
            </Text>
            <Text style={styles.diffTheirs}>
              {t('conflict.office', { value: render((record.conflictData ?? {})[key]) })}
            </Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primary} onPress={onKeepLocal}>
        <Text style={styles.primaryText}>{t('conflict.keepMine')}</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onKeepServer}>
        <Text style={styles.secondaryText}>{t('conflict.useOffice')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.lg,
  },

  lockBanner: {
    backgroundColor: color.canvas,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  lockText: { ...type.help, color: color.inkMuted },

  conflictWrap: { flex: 1, padding: space.lg, gap: space.md },
  title: { fontSize: 24, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  body: { ...type.body, color: color.inkMuted },

  diffList: { flex: 1, gap: space.md, marginTop: space.md },
  diffRow: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
    borderLeftWidth: 4,
    borderLeftColor: color.conflict,
  },
  diffField: { ...type.label, color: color.ink },
  diffMine: { ...type.body, color: color.ink },
  diffTheirs: { ...type.body, color: color.inkMuted },

  primary: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...type.label, fontSize: 19, color: color.surface },
  secondary: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { ...type.label, fontSize: 19, color: color.ink },
});
