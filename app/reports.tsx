import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useDb } from '../src/db/context';
import { useAuth } from '../src/auth/session';
import { useI18n, type Translate } from '../src/i18n';
import { listRecords, type FieldRecord } from '../src/db/records';
import { PERIODS, periodStart, type Period } from '../src/reporting/period';
import { ISSUE_SCHEMA, JOB_SCHEMA } from '../src/schema/bundled';
import { color, radius, shadow, space, TOUCH, type } from '../src/components/theme';

/**
 * Everything on this screen is computed from the local database at render
 * time. There is no reporting table to keep in sync: the records are the
 * report. When the office server arrives this same screen works over the
 * merged data with no changes.
 */

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

interface Report {
  salesTotal: number;
  salesPaid: number;
  salesOutstanding: number;
  salesAvg: number;
  jobsStarted: number;
  jobsSubmitted: number;
  boxesPacked: number;
  crew: { name: string; jobs: number; value: number }[];
  issuesReported: number;
  issuesVerified: number;
  issuesAwaiting: number;
  messages: number;
}

function buildReport(
  jobs: FieldRecord[],
  issues: FieldRecord[],
  messageCount: number,
  since: number,
): Report {
  const started = jobs.filter((job) => job.createdAt >= since);
  const submitted = started.filter((job) => job.status !== 'draft');

  let salesTotal = 0;
  let salesPaid = 0;
  let valuedJobs = 0;
  let boxesPacked = 0;
  const crew = new Map<string, { jobs: number; value: number }>();

  for (const job of submitted) {
    const value = Number(job.data.job_value) || 0;
    if (value > 0) {
      salesTotal += value;
      valuedJobs += 1;
      if (job.data.payment_status === 'paid') salesPaid += value;
    }
    boxesPacked += Number(job.data.boxes_packed) || 0;

    const lead = String(job.data.crew_lead ?? '').trim();
    if (lead) {
      const entry = crew.get(lead) ?? { jobs: 0, value: 0 };
      entry.jobs += 1;
      entry.value += value;
      crew.set(lead, entry);
    }
  }

  const reported = issues.filter(
    (issue) => issue.status !== 'draft' && issue.createdAt >= since,
  );
  const verified = reported.filter((issue) => Boolean(issue.data.verified_at));

  return {
    salesTotal,
    salesPaid,
    salesOutstanding: salesTotal - salesPaid,
    salesAvg: valuedJobs > 0 ? salesTotal / valuedJobs : 0,
    jobsStarted: started.length,
    jobsSubmitted: submitted.length,
    boxesPacked,
    crew: [...crew.entries()]
      .map(([name, entry]) => ({ name, ...entry }))
      .sort((a, b) => b.jobs - a.jobs),
    issuesReported: reported.length,
    issuesVerified: verified.length,
    issuesAwaiting: reported.length - verified.length,
    messages: messageCount,
  };
}

function shareText(t: Translate, periodLabel: string, r: Report): string {
  return [
    `${t('reports.title')} — ${periodLabel}`,
    '',
    `${t('reports.sales')}`,
    `  ${t('reports.salesTotal')}: ${money(r.salesTotal)}`,
    `  ${t('reports.salesPaid')}: ${money(r.salesPaid)}`,
    `  ${t('reports.salesOutstanding')}: ${money(r.salesOutstanding)}`,
    '',
    `${t('reports.jobs')}`,
    `  ${t('reports.jobsStarted')}: ${r.jobsStarted}`,
    `  ${t('reports.jobsSubmitted')}: ${r.jobsSubmitted}`,
    `  ${t('reports.boxesPacked')}: ${r.boxesPacked}`,
    '',
    `${t('reports.issues')}`,
    `  ${t('reports.issuesReported')}: ${r.issuesReported}`,
    `  ${t('reports.issuesVerified')}: ${r.issuesVerified}`,
    `  ${t('reports.issuesAwaiting')}: ${r.issuesAwaiting}`,
  ].join('\n');
}

export default function Reports() {
  const { db } = useDb();
  const { user } = useAuth();
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('last30');
  const [jobs, setJobs] = useState<FieldRecord[]>([]);
  const [issues, setIssues] = useState<FieldRecord[]>([]);
  const [messageCount, setMessageCount] = useState(0);

  // Memoized so the effects below re-run when the period changes, not on
  // every render (periodStart reads the clock, so its raw value never repeats).
  const since = useMemo(() => periodStart(period), [period]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        listRecords(db, { schemaId: JOB_SCHEMA.id }, 1000),
        listRecords(db, { schemaId: ISSUE_SCHEMA.id }, 1000),
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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void db
        .getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM messages WHERE created_at >= ?',
          since,
        )
        .then((row) => {
          if (active) setMessageCount(row?.n ?? 0);
        });
      return () => {
        active = false;
      };
    }, [db, since]),
  );

  const report = useMemo(
    () => buildReport(jobs, issues, messageCount, since),
    [jobs, issues, messageCount, since],
  );

  const staff = user?.role === 'supervisor' || user?.role === 'manager';
  if (!staff) return <View style={styles.flex} />;

  const empty =
    report.jobsStarted === 0 && report.issuesReported === 0 && report.messages === 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('reports.title') }} />

      <View style={styles.chips}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.chip, period === p.key && styles.chipActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.chipText, period === p.key && styles.chipTextActive]}>
              {t(p.label)}
            </Text>
          </Pressable>
        ))}
      </View>

      {empty ? <Text style={styles.empty}>{t('reports.empty')}</Text> : null}

      <Text style={styles.sectionLabel}>{t('reports.sales')}</Text>
      <View style={styles.card}>
        <Row label={t('reports.salesTotal')} value={money(report.salesTotal)} strong />
        <Row label={t('reports.salesPaid')} value={money(report.salesPaid)} tint={color.synced} />
        <Row
          label={t('reports.salesOutstanding')}
          value={money(report.salesOutstanding)}
          tint={report.salesOutstanding > 0 ? color.queued : color.inkMuted}
        />
        <Row label={t('reports.salesAvg')} value={money(report.salesAvg)} />
        <Text style={styles.note}>{t('reports.salesNote')}</Text>
      </View>

      <Text style={styles.sectionLabel}>{t('reports.jobs')}</Text>
      <View style={styles.card}>
        <Row label={t('reports.jobsStarted')} value={String(report.jobsStarted)} />
        <Row label={t('reports.jobsSubmitted')} value={String(report.jobsSubmitted)} strong />
        <Row label={t('reports.boxesPacked')} value={String(report.boxesPacked)} />
      </View>

      {report.crew.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t('reports.crew')}</Text>
          <View style={styles.card}>
            {report.crew.map((entry) => (
              <Row
                key={entry.name}
                label={entry.name}
                value={`${t('reports.crewJobs', { n: entry.jobs })}${
                  entry.value > 0 ? ` · ${money(entry.value)}` : ''
                }`}
              />
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>{t('reports.issues')}</Text>
      <View style={styles.card}>
        <Row label={t('reports.issuesReported')} value={String(report.issuesReported)} />
        <Row
          label={t('reports.issuesVerified')}
          value={String(report.issuesVerified)}
          tint={color.synced}
        />
        <Row
          label={t('reports.issuesAwaiting')}
          value={String(report.issuesAwaiting)}
          tint={report.issuesAwaiting > 0 ? color.conflict : color.inkMuted}
        />
      </View>

      <Text style={styles.sectionLabel}>{t('reports.team')}</Text>
      <View style={styles.card}>
        <Row label={t('reports.messages')} value={String(report.messages)} />
      </View>

      <Pressable
        style={styles.primary}
        onPress={() => {
          const label = t(PERIODS.find((p) => p.key === period)!.label);
          void Share.share({ message: shareText(t, label, report) });
        }}
      >
        <Text style={styles.primaryText}>{t('reports.share')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  strong,
  tint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tint?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong, tint ? { color: tint } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    minHeight: TOUCH - 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.line,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  chipActive: { backgroundColor: color.brand, borderColor: color.brand },
  chipText: { ...type.meta, color: color.inkMuted },
  chipTextActive: { color: color.surface },

  empty: { ...type.body, color: color.inkMuted, textAlign: 'center', marginTop: space.md },

  sectionLabel: {
    ...type.section,
    color: color.inkMuted,
    textTransform: 'uppercase',
    marginTop: space.md,
  },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: space.md,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowLabel: { ...type.body, color: color.ink, flex: 1 },
  rowValue: { ...type.label, color: color.ink },
  rowValueStrong: { fontSize: 22, fontWeight: '700', color: color.brand },
  note: { ...type.help, color: color.inkFaint },

  primary: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
    ...shadow.raised,
  },
  primaryText: { ...type.label, color: color.surface },
});
