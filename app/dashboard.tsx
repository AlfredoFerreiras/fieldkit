import React, { useCallback, useMemo, useState } from 'react';

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useDb } from '../src/db/context';
import { useAuth } from '../src/auth/session';
import { useI18n, type MessageKey } from '../src/i18n';
import { listRecords, type FieldRecord, type RecordStatus } from '../src/db/records';
import { DAY, PERIODS, periodStart, weekStart, type Period } from '../src/reporting/period';
import { useNow } from '../src/reporting/useNow';
import { ISSUE_SCHEMA, JOB_SCHEMA } from '../src/schema/bundled';
import { localized, type FormField, type FormSchema } from '../src/schema/types';
import { color, radius, shadow, space, TOUCH, type } from '../src/components/theme';

/**
 * Visual companion to the Reports screen: same local records, drawn instead of
 * tabulated. Charts are plain Views — a bar is a rounded box with a
 * proportional height — which keeps the dashboard dependency-free and lets it
 * inherit the theme like any other screen.
 *
 * Chart conventions: bars stay thin with a rounded data-end and square
 * baseline, single-series charts carry one hue and no legend, every
 * distribution row is labeled with its name and count so color never carries
 * identity alone, and severity uses an ordered light-to-dark ramp of the brand
 * hue.
 */

const STATUS_ORDER: RecordStatus[] = ['draft', 'queued', 'synced', 'conflict'];

const STATUS_TINT: Record<RecordStatus, string> = {
  draft: color.draft,
  queued: color.queued,
  synced: color.synced,
  conflict: color.conflict,
};

/** Ordered light→dark steps of the brand hue for smoke severity. */
const SEVERITY_RAMP = ['#FB923C', '#EA580C', '#C2410C', '#9A3412'];

const WEEKS = 8;

function shortDate(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function money(n: number): string {
  if (n >= 100_000) return `$${Math.round(n / 1000)}K`;
  if (n >= 10_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function findField(schema: FormSchema, id: string): FormField | undefined {
  for (const section of schema.sections) {
    for (const field of section.fields) if (field.id === id) return field;
  }
  return undefined;
}

export default function Dashboard() {
  const { db } = useDb();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<Period>('last30');
  const [jobs, setJobs] = useState<FieldRecord[]>([]);
  const [issues, setIssues] = useState<FieldRecord[]>([]);

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

  const now = useNow();

  const stats = useMemo(() => {
    const since = periodStart(period);
    const inPeriod = jobs.filter((job) => job.createdAt >= since);
    const submitted = inPeriod.filter((job) => job.status !== 'draft');

    let sales = 0;
    let boxes = 0;
    const statusCounts: Record<RecordStatus, number> = {
      draft: 0,
      queued: 0,
      synced: 0,
      conflict: 0,
    };
    const smoke = new Map<string, number>();
    const areas = new Map<string, number>();
    const crew = new Map<string, { jobs: number; value: number }>();

    for (const job of inPeriod) statusCounts[job.status] += 1;

    for (const job of submitted) {
      const value = Number(job.data.job_value) || 0;
      sales += value;
      boxes += Number(job.data.boxes_packed) || 0;

      const level = String(job.data.smoke_level ?? '');
      if (level) smoke.set(level, (smoke.get(level) ?? 0) + 1);

      const affected = job.data.areas_affected;
      if (Array.isArray(affected)) {
        for (const area of affected) {
          areas.set(String(area), (areas.get(String(area)) ?? 0) + 1);
        }
      }

      const lead = String(job.data.crew_lead ?? '').trim();
      if (lead) {
        const entry = crew.get(lead) ?? { jobs: 0, value: 0 };
        entry.jobs += 1;
        entry.value += value;
        crew.set(lead, entry);
      }
    }

    const reported = issues.filter((issue) => issue.status !== 'draft' && issue.createdAt >= since);
    const awaiting = reported.filter((issue) => !issue.data.verified_at).length;

    // Weekly trend is a fixed window on purpose: a trend needs a stable x-axis,
    // so the period chips do not reshape it.
    const thisWeek = weekStart(now);
    const weeks = Array.from({ length: WEEKS }, (_, i) => thisWeek - (WEEKS - 1 - i) * 7 * DAY);
    const jobsPerWeek = weeks.map((start) => ({ start, value: 0 }));
    const salesPerWeek = weeks.map((start) => ({ start, value: 0 }));
    for (const job of jobs) {
      if (job.status === 'draft') continue;
      const bucket = weeks.indexOf(weekStart(job.createdAt));
      if (bucket === -1) continue;
      jobsPerWeek[bucket].value += 1;
      salesPerWeek[bucket].value += Number(job.data.job_value) || 0;
    }

    return {
      sales,
      boxes,
      submitted: submitted.length,
      awaiting,
      statusCounts,
      smoke,
      areas,
      crew,
      jobsPerWeek,
      salesPerWeek,
      empty: inPeriod.length === 0 && reported.length === 0,
    };
  }, [jobs, issues, period, now]);

  const staff = user?.role === 'supervisor' || user?.role === 'manager';
  if (!staff) return <View style={styles.flex} />;

  const smokeField = findField(JOB_SCHEMA, 'smoke_level');
  const areaField = findField(JOB_SCHEMA, 'areas_affected');

  const smokeRows = (smokeField?.options ?? []).map((opt, i) => ({
    key: opt.value,
    label: localized(opt.label, opt.labels, locale) ?? opt.label,
    value: stats.smoke.get(opt.value) ?? 0,
    tint: SEVERITY_RAMP[Math.min(i, SEVERITY_RAMP.length - 1)],
  }));

  const areaRows = [...stats.areas.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([value, count]) => {
      const opt = areaField?.options?.find((o) => o.value === value);
      return {
        key: value,
        label: opt ? (localized(opt.label, opt.labels, locale) ?? opt.label) : value,
        value: count,
        tint: color.brand,
      };
    });

  const crewRows = [...stats.crew.entries()]
    .sort((a, b) => b[1].jobs - a[1].jobs)
    .map(([name, entry]) => ({
      key: name,
      label: name,
      value: entry.jobs,
      display: `${entry.jobs}${entry.value > 0 ? ` · ${money(entry.value)}` : ''}`,
      tint: color.brand,
    }));

  const statusRows = STATUS_ORDER.map((status) => ({
    key: status,
    label: t(`status.${status}` as MessageKey),
    value: stats.statusCounts[status],
    tint: STATUS_TINT[status],
  }));

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('dashboard.title') }} />

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

      {stats.empty ? <Text style={styles.empty}>{t('reports.empty')}</Text> : null}

      <View style={styles.tileRow}>
        <Tile label={t('reports.sales')} value={money(stats.sales)} />
        <Tile label={t('dashboard.jobsTile')} value={String(stats.submitted)} />
      </View>
      <View style={styles.tileRow}>
        <Tile
          label={t('dashboard.issuesTile')}
          value={String(stats.awaiting)}
          tint={stats.awaiting > 0 ? color.conflict : undefined}
        />
        <Tile label={t('reports.boxesPacked')} value={String(stats.boxes)} />
      </View>

      <ColumnChart
        title={t('dashboard.jobsPerWeek')}
        subtitle={t('dashboard.last8')}
        buckets={stats.jobsPerWeek}
        format={(n) => String(n)}
        weekOf={(d) => t('dashboard.weekOf', { date: d })}
        emptyText={t('reports.empty')}
      />

      <ColumnChart
        title={t('dashboard.salesPerWeek')}
        subtitle={t('dashboard.last8')}
        buckets={stats.salesPerWeek}
        format={money}
        weekOf={(d) => t('dashboard.weekOf', { date: d })}
        emptyText={t('reports.empty')}
      />

      <BarCard title={t('dashboard.status')} rows={statusRows} showZero />
      {smokeRows.some((row) => row.value > 0) ? (
        <BarCard title={t('dashboard.smoke')} rows={smokeRows} showZero />
      ) : null}
      {areaRows.length > 0 ? <BarCard title={t('dashboard.areas')} rows={areaRows} /> : null}
      {crewRows.length > 0 ? <BarCard title={t('reports.crew')} rows={crewRows} /> : null}
    </ScrollView>
  );
}

function Tile({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const CHART_HEIGHT = 120;

function ColumnChart({
  title,
  subtitle,
  buckets,
  format,
  weekOf,
  emptyText,
}: {
  title: string;
  subtitle: string;
  buckets: { start: number; value: number }[];
  format: (n: number) => string;
  weekOf: (date: string) => string;
  emptyText: string;
}) {
  const [selected, setSelected] = useState(buckets.length - 1);
  const max = Math.max(...buckets.map((b) => b.value));
  const maxIndex = buckets.findIndex((b) => b.value === max);
  const current = buckets[selected];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{subtitle}</Text>

      {max === 0 ? (
        <Text style={styles.chartEmpty}>{emptyText}</Text>
      ) : (
        <>
          {current ? (
            <Text style={styles.chartReadout}>
              {weekOf(shortDate(current.start))} · {format(current.value)}
            </Text>
          ) : null}
          <View style={styles.plot}>
            {buckets.map((bucket, i) => {
              const h = max > 0 ? Math.round((bucket.value / max) * CHART_HEIGHT) : 0;
              return (
                <Pressable key={bucket.start} style={styles.slot} onPress={() => setSelected(i)}>
                  {i === maxIndex && bucket.value > 0 ? (
                    <Text style={styles.barLabel}>{format(bucket.value)}</Text>
                  ) : null}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(h, bucket.value > 0 ? 4 : 2),
                        backgroundColor:
                          bucket.value === 0
                            ? color.line
                            : i === selected
                              ? color.brandPressed
                              : color.brand,
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.baseline} />
          <View style={styles.ticks}>
            {buckets.map((bucket, i) => (
              <Text key={bucket.start} style={styles.tick}>
                {i % 2 === 0 ? shortDate(bucket.start) : ''}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function BarCard({
  title,
  rows,
  showZero,
}: {
  title: string;
  rows: { key: string; label: string; value: number; display?: string; tint: string }[];
  showZero?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  const visible = showZero ? rows : rows.filter((row) => row.value > 0);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.rows}>
        {visible.map((row) => (
          <View key={row.key} style={styles.hRow}>
            <View style={styles.hHead}>
              <Text style={styles.hLabel} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={styles.hValue}>{row.display ?? String(row.value)}</Text>
            </View>
            <View style={styles.hTrack}>
              <View
                style={[
                  styles.hFill,
                  { width: `${Math.round((row.value / max) * 100)}%`, backgroundColor: row.tint },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
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

  tileRow: { flexDirection: 'row', gap: space.md },
  tile: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: 4,
    ...shadow.card,
  },
  tileValue: { fontSize: 26, fontWeight: '700', color: color.ink },
  tileLabel: { ...type.meta, color: color.inkMuted },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    ...shadow.card,
  },
  cardTitle: { ...type.label, color: color.ink },
  cardSub: { ...type.meta, color: color.inkFaint, marginTop: 2 },
  chartEmpty: { ...type.help, color: color.inkMuted, marginTop: space.md },
  chartReadout: { ...type.meta, color: color.inkMuted, marginTop: space.sm },

  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT + 20,
    marginTop: space.sm,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: {
    width: '100%',
    maxWidth: 24,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barLabel: { ...type.meta, fontSize: 11, color: color.inkMuted },
  baseline: { height: 1, backgroundColor: color.line },
  ticks: { flexDirection: 'row', marginTop: 4 },
  tick: { flex: 1, ...type.meta, fontSize: 10, color: color.inkFaint, textAlign: 'center' },

  rows: { gap: space.md, marginTop: space.md },
  hRow: { gap: 4 },
  hHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hLabel: { ...type.help, color: color.ink, flex: 1 },
  hValue: { ...type.meta, color: color.inkMuted },
  hTrack: {
    height: 12,
    borderRadius: 4,
    backgroundColor: color.canvas,
    overflow: 'hidden',
  },
  hFill: {
    height: '100%',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
});
