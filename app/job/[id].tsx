import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDb } from '../_layout';
import { getRecord, saveDraft, submit, type FieldRecord } from '../../src/db/records';
import { resolveKeepLocal, resolveKeepServer } from '../../src/sync/engine';
import { FormRenderer } from '../../src/components/FormRenderer';
import type { FormSchema, FormValues } from '../../src/schema/types';
import fireRestoration from '../../src/schema/examples/fire-restoration.json';
import { color, radius, space, TOUCH, type } from '../../src/components/theme';

const SCHEMA = fireRestoration as FormSchema;

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, syncNow, refresh } = useDb();
  const router = useRouter();
  const [record, setRecord] = useState<FieldRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getRecord(db, id).then((r) => {
      setRecord(r);
      setLoading(false);
    });
  }, [db, id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>This job report is no longer on the phone.</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Back to the list</Text>
        </Pressable>
      </View>
    );
  }

  async function handleSubmit(values: FormValues) {
    await submit(db, SCHEMA, record!.id, values);
    await refresh();
    void syncNow();
    router.back();
    Alert.alert(
      'Report submitted',
      'It is saved on this phone and sends itself to the office as soon as you have signal.',
    );
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
      {readOnly ? (
        <View style={styles.lockBanner}>
          <Text style={styles.lockText}>
            Submitted. Changes now would not reach the office, so this is read only.
          </Text>
        </View>
      ) : null}

      <FormRenderer
        schema={SCHEMA}
        initialValues={record.data}
        submitLabel="Submit job report"
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
  const differing = Object.keys({ ...record.data, ...(record.conflictData ?? {}) }).filter(
    (key) => JSON.stringify(record.data[key]) !== JSON.stringify((record.conflictData ?? {})[key]),
  );

  return (
    <View style={styles.conflictWrap}>
      <Text style={styles.title}>Someone else changed this job report</Text>
      <Text style={styles.body}>
        Your phone and the office have different answers. Pick which version to keep. Nothing is
        discarded until you choose.
      </Text>

      <View style={styles.diffList}>
        {differing.map((key) => (
          <View key={key} style={styles.diffRow}>
            <Text style={styles.diffField}>{key}</Text>
            <Text style={styles.diffMine}>Yours: {render(record.data[key])}</Text>
            <Text style={styles.diffTheirs}>
              Office: {render((record.conflictData ?? {})[key])}
            </Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primary} onPress={onKeepLocal}>
        <Text style={styles.primaryText}>Keep what I entered</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onKeepServer}>
        <Text style={styles.secondaryText}>Use the office version</Text>
      </Pressable>
    </View>
  );
}

function render(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'blank';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
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
