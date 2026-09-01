import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDb } from '../../src/db/context';
import { useAuth } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { relativeTime } from '../../src/i18n/relativeTime';
import { createDraft, listRecords, type FieldRecord } from '../../src/db/records';
import { ISSUE_SCHEMA, JOB_SCHEMA } from '../../src/schema/bundled';
import { summaryFor } from '../../src/schema/types';
import { StatusPill } from '../../src/components/StatusPill';
import { color, radius, shadow, space, TOUCH, type } from '../../src/components/theme';

export default function Home() {
  const { user } = useAuth();

  if (user?.role === 'customer') return <CustomerHome />;
  return <StaffHome />;
}

function StaffHome() {
  const { db } = useDb();
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [jobs, setJobs] = useState<FieldRecord[]>([]);
  const [issues, setIssues] = useState<FieldRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        listRecords(db, { schemaId: JOB_SCHEMA.id }),
        listRecords(db, { schemaId: ISSUE_SCHEMA.id }),
      ]).then(([jobRows, issueRows]) => {
        if (!active) return;
        setJobs(jobRows);
        setIssues(issueRows);
      });
      return () => {
        active = false;
      };
    }, [db]),
  );

  const unverified = issues.filter(
    (issue) => issue.status !== 'draft' && !issue.data.verified_at,
  ).length;
  const waiting = jobs.filter((job) => job.status === 'queued').length;
  const drafts = jobs.filter((job) => job.status === 'draft').length;
  const sent = jobs.filter((job) => job.status === 'synced').length;

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
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.hello}>{t('home.hello', { name: user?.name ?? '' })}</Text>

      <Text style={styles.sectionLabel}>{t('home.overview')}</Text>
      <View style={styles.statRow}>
        <StatCard label={t('status.draft')} value={drafts} tint={color.draft} />
        <StatCard label={t('status.queued')} value={waiting} tint={color.queued} />
        <StatCard label={t('status.synced')} value={sent} tint={color.synced} />
      </View>

      <Pressable style={styles.issueCard} onPress={() => router.push('/issues')}>
        <Text style={styles.issueCount}>{issues.length}</Text>
        <View style={styles.issueMain}>
          <Text style={styles.issueTitle}>{t('home.issues')}</Text>
          <Text style={[styles.issueMeta, unverified > 0 && { color: color.conflict }]}>
            {unverified > 0 ? t('home.awaiting', { n: unverified }) : t('home.allVerified')}
          </Text>
        </View>
      </Pressable>

      <Pressable style={styles.primary} onPress={startJob}>
        <Text style={styles.primaryText}>{t('home.startJob')}</Text>
      </Pressable>
    </ScrollView>
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
    </ScrollView>
  );
}

function StatCard({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  hello: { ...type.title, color: color.ink, marginBottom: space.sm },
  intro: { ...type.body, color: color.inkMuted },

  sectionLabel: {
    ...type.section,
    color: color.inkMuted,
    textTransform: 'uppercase',
    marginTop: space.md,
  },

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
  statValue: { fontSize: 32, fontWeight: '700' },
  statLabel: { ...type.meta, color: color.inkMuted, textAlign: 'center' },

  issueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: space.lg,
    ...shadow.card,
  },
  issueCount: { fontSize: 32, fontWeight: '700', color: color.brand, minWidth: 44 },
  issueMain: { flex: 1, gap: 2 },
  issueTitle: { ...type.label, color: color.ink },
  issueMeta: { ...type.meta, color: color.inkMuted },

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
});
