/**
 * Segments: personal segments found automatically across your activities,
 * with attempts, best time and progression. Personal only, no leaderboards.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import { useAnalytics } from '../context/AnalyticsContext';
import { useSummaries } from '../hooks/useSummaries';
import { Badge, Card, FadeInView, NOMA_COLORS } from '../components/UIComponents';
import { LineChart } from '../components/Charts';
import { InsightEmpty, Metric, ScreenTitle, SectionTitle, formatShortDate } from '../components/Blocks';
import { formatRecordTime } from '../analytics/personalRecords';
import { summarizeSegment } from '../analytics/segments';
import { StatisticsService } from '../services/StatisticsService';

export const SegmentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  useSummaries();
  const { snapshot } = useAnalytics();
  const summaries = useMemo(
    () =>
      snapshot.segments.segments
        .map((s) => summarizeSegment(s, snapshot.segments.attempts))
        .sort((a, b) => b.attempts.length - a.attempts.length),
    [snapshot.segments]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ScreenTitle title="Segments" subtitle="Les parcours que vous avez courus plus d’une fois" />
        {summaries.length === 0 ? (
          <Card>
            <InsightEmpty message="Aucun segment pour le moment. Quand vous courez le même tronçon (400 m ou plus) dans le même sens lors de deux sorties, il apparaît ici automatiquement." />
          </Card>
        ) : (
          summaries.map((sm, i) => (
            <FadeInView key={sm.segment.id} delay={i * 40}>
              <Card
                style={{ marginBottom: 12 }}
                onPress={() => navigation.navigate('SegmentDetail', { segmentId: sm.segment.id })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: NOMA_COLORS.charcoal }}>{sm.segment.name}</Text>
                    <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 2 }}>
                      {(sm.segment.lengthMeters / 1000).toFixed(2)} km · {sm.attempts.length} passage{sm.attempts.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {sm.best && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: NOMA_COLORS.textSecondary }}>MEILLEUR</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: NOMA_COLORS.charcoal }}>
                        {formatRecordTime(sm.best.elapsedMs)}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            </FadeInView>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export const SegmentDetailScreen: React.FC<{ route: { params: { segmentId: string } }; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { snapshot } = useAnalytics();
  const segment = snapshot.segments.segments.find((s) => s.id === route.params.segmentId);
  const summary = useMemo(
    () => (segment ? summarizeSegment(segment, snapshot.segments.attempts) : null),
    [segment, snapshot.segments.attempts]
  );

  if (!segment || !summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: NOMA_COLORS.textSecondary }}>Segment introuvable</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ScreenTitle title={segment.name} subtitle={`${(segment.lengthMeters / 1000).toFixed(2)} km`} />

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row' }}>
            <Metric label="Meilleur" value={summary.best ? formatRecordTime(summary.best.elapsedMs) : '--'} />
            <Metric label="Dernier" value={summary.latest ? formatRecordTime(summary.latest.elapsedMs) : '--'} />
            <Metric label="Passages" value={`${summary.attempts.length}`} />
          </View>
          {summary.attempts.length > 1 && (
            <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 12 }}>
              Progrès depuis le premier passage : {formatRecordTime(summary.improvementMs)}
            </Text>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Progression" />
          {summary.progression.length < 2 ? (
            <InsightEmpty message="Il faut un deuxième passage pour afficher la progression." />
          ) : (
            <LineChart
              values={summary.progression.map((p) => p.elapsedMs / 1000)}
              labels={summary.progression.map((p) => formatShortDate(p.startedAt))}
              invert
              formatValue={(v) => formatRecordTime(v * 1000)}
            />
          )}
        </Card>

        <Card>
          <SectionTitle title="Passages" />
          {[...summary.attempts].reverse().map((a) => (
            <View
              key={a.id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
            >
              <Text
                onPress={() => navigation.navigate('ActivityDetails', { activityId: a.activityId })}
                style={{ flex: 1, color: NOMA_COLORS.charcoal, textDecorationLine: 'underline' }}
              >
                {formatShortDate(a.startedAt)}
              </Text>
              <Text style={{ color: NOMA_COLORS.textSecondary, marginRight: 12 }}>
                {StatisticsService.formatPace(a.paceMinKm)}/km
              </Text>
              {summary.best?.id === a.id && <Badge label="Meilleur" variant="primary" />}
              <Text style={{ marginLeft: 10, fontWeight: '700', color: NOMA_COLORS.charcoal }}>
                {formatRecordTime(a.elapsedMs)}
              </Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};
