import React, { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDb } from '../../src/db/context';
import { useAuth } from '../../src/auth/session';
import { useI18n, type Locale } from '../../src/i18n';
import { relativeTime } from '../../src/i18n/relativeTime';
import { createDraft, listRecords, type FieldRecord } from '../../src/db/records';
import { weekStart } from '../../src/reporting/period';
import { useNow } from '../../src/reporting/useNow';
import { COMPANY } from '../../src/config';
import { ISSUE_SCHEMA, JOB_SCHEMA } from '../../src/schema/bundled';
import { summaryFor } from '../../src/schema/types';
import { StatusPill } from '../../src/components/StatusPill';
import { SyncBanner } from '../../src/components/SyncBanner';
import { useBadges } from '../../src/notifications/badges';
import { color, radius, shadow, space, TOUCH, type } from '../../src/components/theme';

export default function Home() {
  const { user } = useAuth();

  if (user?.role === 'customer') return <CustomerHome />;
  return <StaffHome />;
}

function longDate(locale: Locale): string {
  try {
    return new Date().toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return new Date().toDateString();
  }
}

function StaffHome() {
  const { db } = useDb();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { unreadChat, openIssues } = useBadges();
  const router = useRouter();
  const [jobs, setJobs] = useState<FieldRecord[]>([]);
  const now = useNow();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRecords(db, { schemaId: JOB_SCHEMA.id }).then((rows) => {
        if (active) setJobs(rows);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const drafts = jobs.filter((job) => job.status === 'draft');
  const queued = jobs.filter((job) => job.status === 'queued');
  const synced = jobs.filter((job) => job.status === 'synced');
  const conflicts = jobs.filter((job) => job.status === 'conflict');

  const thisWeek = weekStart(now);
  const weekSubmitted = jobs.filter((job) => job.status !== 'draft' && job.createdAt >= thisWeek);
  const weekSales = weekSubmitted.reduce((sum, job) => sum + (Number(job.data.job_value) || 0), 0);

  const attentionEmpty = conflicts.length === 0 && drafts.length === 0 && openIssues === 0;

  async function startJob() {
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
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <Text style={styles.hello}>{t('home.hello', { name: user?.name ?? '' })}</Text>
        <Text style={styles.date}>{longDate(locale)}</Text>

        <Text style={styles.sectionLabel}>{t('home.attention')}</Text>
        {attentionEmpty ? (
          <View style={styles.attentionCard}>
            <AttentionRow
              icon="checkmark-circle-outline"
              tint={color.synced}
              title={t('home.allClear')}
            />
          </View>
        ) : (
          <View style={styles.attentionCard}>
            {conflicts.slice(0, 3).map((job, i) => (
              <AttentionRow
                key={job.id}
                icon="alert-circle"
                tint={color.conflict}
                title={summaryFor(JOB_SCHEMA, job.data)}
                sub={t('home.decideConflict')}
                divider={i > 0}
                onPress={() => router.push(`/job/${job.id}`)}
              />
            ))}
            {drafts.slice(0, 3).map((job, i) => (
              <AttentionRow
                key={job.id}
                icon="create-outline"
                tint={color.queued}
                title={summaryFor(JOB_SCHEMA, job.data)}
                sub={`${t('home.finishDraft')} · ${relativeTime(t, job.updatedAt)}`}
                divider={conflicts.length > 0 || i > 0}
                onPress={() => router.push(`/job/${job.id}`)}
              />
            ))}
            {openIssues > 0 ? (
              <AttentionRow
                icon="chatbox-ellipses-outline"
                tint={color.conflict}
                title={t('home.verifyIssues', { n: openIssues })}
                divider={conflicts.length > 0 || drafts.length > 0}
                onPress={() => router.push('/issues')}
              />
            ) : null}
          </View>
        )}

        <Text style={styles.sectionLabel}>{t('home.overview')}</Text>
        <View style={styles.statRow}>
          <StatCard label={t('status.draft')} value={drafts.length} tint={color.draft} />
          <StatCard label={t('status.queued')} value={queued.length} tint={color.queued} />
          <StatCard label={t('status.synced')} value={synced.length} tint={color.synced} />
        </View>

        <Text style={styles.sectionLabel}>{t('home.thisWeek')}</Text>
        <View style={styles.statRow}>
          <StatCard label={t('home.weekJobs')} value={weekSubmitted.length} tint={color.brand} />
          <StatCard
            label={t('home.weekSales')}
            value={`$${Math.round(weekSales).toLocaleString()}`}
            tint={color.brand}
          />
        </View>

        <View style={styles.quickGrid}>
          <QuickAction
            icon="stats-chart-outline"
            label={t('home.dashboard')}
            onPress={() => router.push('/dashboard')}
          />
          <QuickAction
            icon="bar-chart-outline"
            label={t('home.reports')}
            onPress={() => router.push('/reports')}
          />
          <QuickAction
            icon="alert-circle-outline"
            label={t('tabs.issues')}
            badge={openIssues}
            onPress={() => router.push('/issues')}
          />
          <QuickAction
            icon="chatbubbles-outline"
            label={t('tabs.chat')}
            badge={unreadChat}
            onPress={() => router.push('/chat')}
          />
        </View>

        <Pressable style={styles.primary} onPress={startJob}>
          <Text style={styles.primaryText}>{t('home.startJob')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function CustomerHome() {
  const { db } = useDb();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [mine, setMine] = useState<FieldRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void listRecords(db, { schemaId: ISSUE_SCHEMA.id, createdBy: user?.id }).then((rows) => {
        if (active) setMine(rows);
      });
      return () => {
        active = false;
      };
    }, [db, user?.id]),
  );

  async function reportIssue() {
    const record = await createDraft(
      db,
      ISSUE_SCHEMA,
      {
        contact_name: user?.name ?? '',
        contact_phone: user?.phone ?? '',
        contact_email: user?.email ?? '',
      },
      user?.id ?? null,
    );
    router.push(`/issue/${record.id}`);
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.hello}>{t('home.hello', { name: user?.name ?? '' })}</Text>
      <Text style={styles.intro}>{t('home.customerIntro')}</Text>

      <Pressable style={styles.primary} onPress={reportIssue}>
        <Text style={styles.primaryText}>{t('home.reportIssue')}</Text>
      </Pressable>

      {mine.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t('home.myIssues')}</Text>
          {mine.map((issue) => (
            <Pressable
              key={issue.id}
              style={styles.mineCard}
              onPress={() => router.push(`/issue/${issue.id}`)}
            >
              <View style={styles.mineMain}>
                <Text style={styles.mineTitle} numberOfLines={1}>
                  {summaryFor(ISSUE_SCHEMA, issue.data)}
                </Text>
                <Text style={styles.mineMeta}>{relativeTime(t, issue.updatedAt)}</Text>
              </View>
              <StatusPill status={issue.status} />
            </Pressable>
          ))}
        </>
      ) : null}

      <Text style={styles.sectionLabel}>{t('home.needHelp')}</Text>
      <View style={styles.contactCard}>
        <Text style={styles.contactName}>{COMPANY.name}</Text>
        <Text style={styles.contactBody}>{t('home.helpBody')}</Text>
        <View style={styles.contactRow}>
          <ContactButton
            icon="call-outline"
            label={t('home.callOffice')}
            onPress={() => void Linking.openURL(`tel:${COMPANY.phone}`)}
          />
          <ContactButton
            icon="chatbox-outline"
            label={t('home.textOffice')}
            onPress={() => void Linking.openURL(`sms:${COMPANY.phone}`)}
          />
          <ContactButton
            icon="mail-outline"
            label={t('home.emailOffice')}
            onPress={() => void Linking.openURL(`mailto:${COMPANY.email}`)}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function AttentionRow({
  icon,
  tint,
  title,
  sub,
  divider,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  sub?: string;
  divider?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={[styles.attentionRow, divider && styles.attentionDivider]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={24} color={tint} />
      <View style={styles.attentionMain}>
        <Text style={styles.attentionTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? <Text style={styles.attentionSub}>{sub}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={color.inkFaint} /> : null}
    </Pressable>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number | string; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quick} onPress={onPress}>
      <View>
        <Ionicons name={icon} size={26} color={color.brand} />
        {badge && badge > 0 ? (
          <View style={styles.quickBadge}>
            <Text style={styles.quickBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ContactButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.contact} onPress={onPress}>
      <Ionicons name={icon} size={22} color={color.brand} />
      <Text style={styles.contactLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  hello: { ...type.title, color: color.ink },
  date: { ...type.meta, color: color.inkMuted, marginBottom: space.sm },
  intro: { ...type.body, color: color.inkMuted },

  sectionLabel: {
    ...type.section,
    color: color.inkMuted,
    textTransform: 'uppercase',
    marginTop: space.md,
  },

  attentionCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    ...shadow.card,
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: TOUCH,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  attentionDivider: { borderTopWidth: 1, borderTopColor: color.line },
  attentionMain: { flex: 1, gap: 2 },
  attentionTitle: { ...type.label, fontSize: 16, color: color.ink },
  attentionSub: { ...type.meta, color: color.inkMuted },

  statRow: { flexDirection: 'row', gap: space.md },
  stat: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: 4,
    alignItems: 'center',
    ...shadow.card,
  },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { ...type.meta, color: color.inkMuted, textAlign: 'center' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
  quick: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: TOUCH + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.lg,
    ...shadow.card,
  },
  quickLabel: { ...type.label, fontSize: 16, color: color.ink, flexShrink: 1 },
  quickBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: color.conflict,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: { fontSize: 11, fontWeight: '700', color: color.surface },

  primary: {
    minHeight: TOUCH + 4,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
    ...shadow.raised,
  },
  primaryText: { ...type.label, fontSize: 19, color: color.surface },

  mineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: space.md,
    ...shadow.card,
  },
  mineMain: { flex: 1, gap: 4 },
  mineTitle: { ...type.label, color: color.ink },
  mineMeta: { ...type.meta, color: color.inkFaint },

  contactCard: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: space.sm,
    ...shadow.card,
  },
  contactName: { ...type.label, color: color.ink },
  contactBody: { ...type.help, color: color.inkMuted },
  contactRow: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  contact: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: space.sm,
  },
  contactLabel: { ...type.meta, color: color.ink },
});
