/**
 * Performance dashboard (section "Analyses" of the Activities hub).
 * Descriptive only: summary of the selected period, evolution, distribution, regularity,
 * calendar and existing records. Every figure comes from the shared activity summaries.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, RefreshControl } from 'react-native';
import { useSummaries } from '../hooks/useSummaries';
import { useAnalytics } from '../context/AnalyticsContext';
import { Button, Card, FadeInView, FONTS, NOMA_COLORS } from '../components/UIComponents';
import { BarChart, LineChart } from '../components/Charts';
import { DeltaText, InsightEmpty, Metric, ScreenTitle, SectionTitle, formatShortDate } from '../components/Blocks';
import { ActivityCalendar, BandBars, LabelWithInfo, MetricInfo, PeriodSelector } from '../components/Insights';
import { ActivityRow } from '../components/ActivityRow';
import { StatisticsService } from '../services/StatisticsService';
import { inRange, paceSeries, summarize } from '../analytics/performance';
import {
  DateRange,
  PeriodPreset,
  compareToPrevious,
  distanceDistribution,
  durationDistribution,
  parseFrDate,
  rangeForPreset,
  regularity,
  weeklyTrendForRange,
} from '../analytics/periods';
import { LONGEST_KEY, PR_DISTANCES, currentRecords, formatRecordTime } from '../analytics/personalRecords';
import { comparisonCaption, fr, monthName } from '../i18n/fr';

const dayMonth = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()} ${monthName(d.getMonth()).slice(0, 4)}.`;
};

const paceText = (v: number | null) => (v !== null ? `${StatisticsService.formatPace(v)}/km` : fr.common.noData);

export const PerformanceScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { summaries, loading, ready, refresh } = useSummaries();
  const { snapshot } = useAnalytics();
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const now = useMemo(() => Date.now(), [summaries, preset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Custom range: both dates must be valid and ordered, otherwise the 30-day period stays in use.
  const custom = useMemo(() => {
    const from = parseFrDate(customFrom);
    const to = parseFrDate(customTo);
    let error: string | null = null;
    if ((customTo.trim() !== '' && to === null) || (customFrom.trim() !== '' && from === null)) error = fr.performance.customInvalid;
    else if (from !== null && to !== null && to < from) error = fr.performance.customOrder;
    const range: DateRange | undefined = from !== null && to !== null && !error ? { from, to } : undefined;
    return { range, error };
  }, [customFrom, customTo]);

  const effective: PeriodPreset = preset === 'custom' && !custom.range ? '30d' : preset;
  const range = useMemo(() => rangeForPreset(effective, now, custom.range), [effective, now, custom.range]);
  const inPeriod = useMemo(() => inRange(summaries, range.from, range.to), [summaries, range]);

  const period = useMemo(() => summarize(inPeriod), [inPeriod]);
  const comparison = useMemo(() => compareToPrevious(summaries, effective, now, custom.range), [summaries, effective, now, custom.range]);
  const elevation = useMemo(() => {
    const known = inPeriod.filter((a) => a.elevationGainM !== null);
    return known.length ? known.reduce((s, a) => s + (a.elevationGainM as number), 0) : null;
  }, [inPeriod]);
  const trend = useMemo(() => weeklyTrendForRange(summaries, range, now, 12), [summaries, range, now]);
  const averagePoints = useMemo(() => trend.filter((t) => t.movingAverageKm !== null), [trend]);
  const pace = useMemo(() => paceSeries(inPeriod).slice(-12), [inPeriod]);
  const byDistance = useMemo(() => distanceDistribution(inPeriod), [inPeriod]);
  const byDuration = useMemo(() => durationDistribution(inPeriod), [inPeriod]);
  const reg = useMemo(() => regularity(summaries, range), [summaries, range]);
  const records = useMemo(() => currentRecords(snapshot.records), [snapshot.records]);
  const recent = useMemo(() => [...inPeriod].sort((a, b) => b.startTime - a.startTime).slice(0, 5), [inPeriod]);

  const recordRows = [
    ...PR_DISTANCES.map((d) => ({ key: `best_${d.key}`, label: d.label })),
    { key: LONGEST_KEY, label: 'Plus longue sortie' },
  ].filter((r) => records[r.key]);

  const openActivity = (id: string) => navigation?.navigate('ActivityDetails', { activityId: id });
  const hasAny = summaries.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={NOMA_COLORS.charcoal} />}
      >
        <ScreenTitle title={fr.performance.title} subtitle={fr.performance.subtitle} />

        {!ready ? (
          <Card>
            <InsightEmpty message="Chargement de vos analyses…" />
          </Card>
        ) : !hasAny ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <Text style={{ fontFamily: FONTS.heading, fontSize: 18, color: NOMA_COLORS.charcoal, marginBottom: 8 }}>{fr.performance.emptyTitle}</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: NOMA_COLORS.textSecondary, textAlign: 'center', marginBottom: 20 }}>
              {fr.performance.emptyBody}
            </Text>
            <Button label={fr.common.startRecording} variant="action" onPress={() => navigation?.navigate('Record')} />
          </Card>
        ) : (
          <>
            <PeriodSelector
              preset={preset}
              onPreset={setPreset}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFrom={setCustomFrom}
              onCustomTo={setCustomTo}
              customError={custom.error}
            />

            <FadeInView>
              <Card style={{ marginBottom: 16 }}>
                <SectionTitle title={fr.performance.summary} />
                {period.count === 0 ? (
                  <InsightEmpty message={fr.performance.periodEmpty} />
                ) : (
                  <>
                    <View style={{ flexDirection: 'row' }}>
                      <Metric label={fr.metrics.distance} value={period.distanceKm.toFixed(1)} unit="km" large />
                      <Metric label={fr.metrics.activities} value={`${period.count}`} large />
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 16 }}>
                      <Metric label={fr.metrics.moving} value={StatisticsService.formatDuration(period.durationMs)} />
                      <Metric label={fr.metrics.pace} value={period.avgPaceMinKm ? StatisticsService.formatPace(period.avgPaceMinKm) : fr.common.noData} unit="/km" />
                      <Metric label={fr.metrics.elevation} value={elevation !== null ? elevation.toFixed(0) : fr.common.noData} unit="m" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                      <MetricInfo metric="moving" />
                      <MetricInfo metric="pace" />
                      <MetricInfo metric="elevation" />
                    </View>

                    <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: NOMA_COLORS.greige, paddingTop: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, color: NOMA_COLORS.textSecondary, flexShrink: 1 }}>
                          {comparisonCaption[effective].toUpperCase()}
                        </Text>
                        <MetricInfo metric="comparison" />
                      </View>
                      {comparison.status !== 'ok' || !comparison.comparison ? (
                        <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: NOMA_COLORS.textSecondary }}>
                          {comparison.reason === 'period_too_short' ? fr.performance.insufficientShort : fr.performance.insufficientFew}
                        </Text>
                      ) : (
                        <View style={{ gap: 4 }}>
                          <DeltaText percent={comparison.comparison.distance.percent} suffix="de distance" />
                          <DeltaText percent={comparison.comparison.duration.percent} suffix="de temps en mouvement" />
                          <DeltaText percent={comparison.comparison.pace.percent} betterWhenLower suffix="d’allure moyenne" />
                          {!comparison.paceComparable && (
                            <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary }}>
                              Allure non comparée : moins de 3 km sur l’une des périodes.
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </>
                )}
              </Card>
            </FadeInView>

            {period.count > 0 && (
              <>
                <FadeInView delay={60}>
                  <Card style={{ marginBottom: 16 }}>
                    <SectionTitle title={fr.performance.evolution} />
                    <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, color: NOMA_COLORS.textSecondary, marginBottom: 8 }}>
                      {fr.performance.weeklyDistance.toUpperCase()}
                    </Text>
                    <BarChart
                      unit="km"
                      data={trend.map((t) => ({
                        label: `${new Date(t.bucket.start).getDate()}`,
                        value: t.distanceKm,
                        highlight: !t.complete,
                        caption: `semaine du ${dayMonth(t.bucket.start)}${t.complete ? '' : ' (en cours)'}`,
                      }))}
                      formatValue={(v) => v.toFixed(v >= 10 ? 0 : 1)}
                    />

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                      <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, color: NOMA_COLORS.textSecondary }}>
                        {fr.performance.movingAverage.toUpperCase()}
                      </Text>
                      <MetricInfo metric="movingAverage" />
                    </View>
                    {averagePoints.length < 2 ? (
                      <InsightEmpty message={fr.performance.movingAverageEmpty} />
                    ) : (
                      <LineChart
                        values={averagePoints.map((t) => t.movingAverageKm as number)}
                        labels={averagePoints.map((t) => `semaine du ${dayMonth(t.bucket.start)}`)}
                        formatValue={(v) => v.toFixed(1)}
                        unit="km par semaine"
                      />
                    )}

                    <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 12, marginBottom: 8 }}>
                      {fr.performance.pace.toUpperCase()}
                    </Text>
                    {pace.length < 2 ? (
                      <InsightEmpty message={fr.performance.paceEmpty} />
                    ) : (
                      <LineChart
                        values={pace.map((p) => p.value)}
                        labels={pace.map((p) => formatShortDate(p.time))}
                        invert
                        formatValue={(v) => paceText(v)}
                      />
                    )}
                  </Card>
                </FadeInView>

                <FadeInView delay={100}>
                  <Card style={{ marginBottom: 16 }}>
                    <LabelWithInfo label={fr.performance.distribution} metric="distribution" />
                    <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, color: NOMA_COLORS.textSecondary, marginVertical: 8 }}>
                      {fr.performance.byDistance.toUpperCase()}
                    </Text>
                    <BandBars rows={byDistance} />
                    <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 12, color: NOMA_COLORS.textSecondary, marginVertical: 8 }}>
                      {fr.performance.byDuration.toUpperCase()}
                    </Text>
                    <BandBars rows={byDuration} />
                  </Card>
                </FadeInView>
              </>
            )}

            <FadeInView delay={140}>
              <Card style={{ marginBottom: 16 }}>
                <LabelWithInfo label={fr.performance.regularity} metric="regularity" />
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Metric label={fr.metrics.activeWeeks} value={`${reg.activeWeeks}/${reg.weeks}`} />
                  <Metric label={fr.metrics.longestStreak} value={`${reg.longestStreakWeeks}`} unit="sem." />
                </View>
                <View style={{ flexDirection: 'row', marginTop: 16 }}>
                  <Metric label={fr.metrics.activeDays} value={`${reg.activeDays}`} />
                  <Metric label={fr.metrics.averageGap} value={reg.avgGapDays !== null ? reg.avgGapDays.toFixed(1) : fr.common.noData} unit="j" />
                </View>
              </Card>
            </FadeInView>

            <Card style={{ marginBottom: 16 }}>
              <SectionTitle title={fr.performance.calendar} />
              <ActivityCalendar items={summaries} now={now} onOpenActivity={openActivity} />
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <SectionTitle title={fr.performance.records} />
              {recordRows.length === 0 ? (
                <InsightEmpty message={fr.performance.recordsEmpty} />
              ) : (
                recordRows.map((r) => {
                  const e = records[r.key];
                  const value = r.key === LONGEST_KEY ? `${(e.value / 1000).toFixed(2)} km` : formatRecordTime(e.value);
                  return (
                    <View
                      key={r.key}
                      accessible
                      accessibilityLabel={`${r.label} : ${value}, le ${formatShortDate(e.achievedAt)}`}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}
                    >
                      <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 14, color: NOMA_COLORS.text }}>{r.label}</Text>
                      <Text style={{ fontFamily: FONTS.bodySemiBold, fontSize: 14, color: NOMA_COLORS.charcoal }}>
                        {value} · {formatShortDate(e.achievedAt)}
                      </Text>
                    </View>
                  );
                })
              )}
              {navigation && (
                <View style={{ marginTop: 8 }}>
                  <Button label={fr.performance.allRecords} variant="secondary" size="small" onPress={() => navigation.navigate('Records')} />
                </View>
              )}
            </Card>

            {recent.length > 0 && (
              <View>
                <SectionTitle title={fr.performance.recent} />
                {recent.map((a) => (
                  <ActivityRow key={a.id} summary={a} onPress={() => openActivity(a.id)} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
