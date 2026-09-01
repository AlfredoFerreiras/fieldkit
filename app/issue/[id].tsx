import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useDb } from '../../src/db/context';
import { useAuth } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import {
  amendSubmitted,
  getRecord,
  saveDraft,
  submit,
  type FieldRecord,
} from '../../src/db/records';
import { ISSUE_SCHEMA } from '../../src/schema/bundled';
import { isVisible, localized, type FormValues } from '../../src/schema/types';
import { FormRenderer } from '../../src/components/FormRenderer';
import { StatusPill } from '../../src/components/StatusPill';
import { color, radius, shadow, space, TOUCH, type } from '../../src/components/theme';

export default function IssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, syncNow, refresh } = useDb();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [record, setRecord] = useState<FieldRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getRecord(db, id).then((row) => {
        if (!active) return;
        setRecord(row);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [db, id]),
  );

  const title = t('issues.report');

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
        <Text style={styles.title}>{t('issues.gone')}</Text>
        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>{t('job.back')}</Text>
        </Pressable>
      </View>
    );
  }

  if (record.status === 'draft') {
    return (
      <View style={styles.flex}>
        <Stack.Screen options={{ title }} />
        <FormRenderer
          schema={ISSUE_SCHEMA}
          initialValues={record.data}
          submitLabel={t('issues.report')}
          onAutosave={(values) => void saveDraft(db, record.id, values)}
          onSubmit={(values) => {
            void (async () => {
              await submit(db, ISSUE_SCHEMA, record.id, values);
              await refresh();
              void syncNow();
              router.back();
              Alert.alert(t('issues.submittedTitle'), t('issues.submittedBody'));
            })();
          }}
        />
      </View>
    );
  }

  const staff = user?.role === 'supervisor' || user?.role === 'manager';
  return staff ? (
    <StaffIssueView
      record={record}
      onVerify={() => {
        void (async () => {
          await amendSubmitted(db, record.id, {
            verified_at: Date.now(),
            verified_by: user?.name ?? '',
          });
          await refresh();
          void syncNow();
          setRecord(await getRecord(db, record.id));
        })();
      }}
    />
  ) : (
    <CustomerIssueView record={record} />
  );
}

function StaffIssueView({ record, onVerify }: { record: FieldRecord; onVerify: () => void }) {
  const { t } = useI18n();
  const phone = String(record.data.contact_phone ?? '');
  const email = String(record.data.contact_email ?? '');
  const verified = Boolean(record.data.verified_at);
  const preferred = record.data.preferred_contact;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('issues.title') }} />

      <IssueAnswers record={record} />

      <View style={styles.contactRow}>
        {phone !== '' ? (
          <>
            <ContactButton
              label={t('issues.call')}
              emphasized={preferred === 'call'}
              onPress={() => void Linking.openURL(`tel:${phone}`)}
            />
            <ContactButton
              label={t('issues.text')}
              emphasized={preferred === 'text'}
              onPress={() => void Linking.openURL(`sms:${phone}`)}
            />
          </>
        ) : null}
        {email !== '' ? (
          <ContactButton
            label={t('issues.email')}
            emphasized={preferred === 'email'}
            onPress={() => void Linking.openURL(`mailto:${email}`)}
          />
        ) : null}
      </View>

      {verified ? (
        <View style={styles.verifiedCard}>
          <Text style={styles.verifiedText}>
            {t('issues.verifiedBy', { name: String(record.data.verified_by ?? '') })}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.help}>{t('issues.verifyHelp')}</Text>
          <Pressable style={styles.primary} onPress={onVerify}>
            <Text style={styles.primaryText}>{t('issues.verify')}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function CustomerIssueView({ record }: { record: FieldRecord }) {
  const { t } = useI18n();
  const verified = Boolean(record.data.verified_at);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('issues.report') }} />
      <View style={styles.statusRow}>
        <StatusPill status={record.status} />
        {verified ? (
          <View style={styles.verifiedPill}>
            <Text style={styles.verifiedPillText}>{t('issues.verified')}</Text>
          </View>
        ) : null}
      </View>
      <IssueAnswers record={record} />
    </ScrollView>
  );
}

function IssueAnswers({ record }: { record: FieldRecord }) {
  const { t, locale } = useI18n();

  return (
    <View style={styles.answers}>
      {ISSUE_SCHEMA.sections.map((section) =>
        section.fields
          .filter((field) => isVisible(field, record.data))
          .map((field) => {
            const raw = record.data[field.id];
            if (raw === undefined || raw === null || raw === '') return null;

            let display: string;
            if (Array.isArray(raw)) {
              display = field.type === 'photo' ? String(raw.length) : raw.map(String).join(', ');
            } else if (typeof raw === 'boolean') {
              display = raw ? t('common.yes') : t('common.no');
            } else {
              display = String(raw);
            }

            const option = field.options?.find((opt) => opt.value === raw);
            if (option) display = localized(option.label, option.labels, locale) ?? option.label;

            return (
              <View key={field.id} style={styles.answer}>
                <Text style={styles.answerLabel}>
                  {localized(field.label, field.labels, locale)}
                </Text>
                <Text style={styles.answerValue}>{display}</Text>
              </View>
            );
          }),
      )}
    </View>
  );
}

function ContactButton({
  label,
  emphasized,
  onPress,
}: {
  label: string;
  emphasized: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.contact, emphasized && styles.contactPreferred]}
      onPress={onPress}
    >
      <Text style={[styles.contactText, emphasized && styles.contactTextPreferred]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.lg,
    backgroundColor: color.canvas,
  },
  title: { fontSize: 24, fontWeight: '700', color: color.ink, letterSpacing: -0.3 },
  help: { ...type.help, color: color.inkMuted },

  statusRow: { flexDirection: 'row', gap: space.sm },

  answers: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: space.md,
    ...shadow.card,
  },
  answer: { gap: 2 },
  answerLabel: { ...type.meta, color: color.inkMuted },
  answerValue: { ...type.body, color: color.ink },

  contactRow: { flexDirection: 'row', gap: space.md },
  contact: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  contactPreferred: { borderColor: color.brand, backgroundColor: color.brandTint },
  contactText: { ...type.label, color: color.ink },
  contactTextPreferred: { color: color.brand },

  verifiedCard: {
    backgroundColor: color.syncedBg,
    borderRadius: radius.md,
    padding: space.lg,
  },
  verifiedText: { ...type.label, color: color.synced },
  verifiedPill: {
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    backgroundColor: color.syncedBg,
  },
  verifiedPillText: { ...type.meta, color: color.synced },

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
    paddingHorizontal: space.xl,
  },
  secondaryText: { ...type.label, fontSize: 19, color: color.ink },
});
