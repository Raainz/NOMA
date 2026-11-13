/**
 * Home: this week at a glance, progression, latest activity and a quick way to record.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, RefreshControl } from 'react-native';
import { useSummaries } from '../hooks/useSummaries';
import { useAnalytics } from '../context/AnalyticsContext';
import { Button, Card, FadeInView, NOMA_COLORS, Badge, FONTS, Wordmark } from '../components/UIComponents';
import { BarChart } from '../components/Charts';
import { ActivityRow } from '../components/ActivityRow';
import { SectionTitle, formatShortDate } from '../components/Blocks';
import { StatisticsService } from '../services/StatisticsService';
import { weeklyBuckets } from '../analytics/performance';
import { compareToPrevious } from '../analytics/periods';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { summaries: activities, loading, refresh } = useSummaries();
  const { snapshot } = useAnalytics();

  const now = useMemo(() => Date.now(), [activities]);
  const buckets = useMemo(() => weeklyBuckets(activities, now, 8), [activities, now]);
  const comparison = useMemo(() => compareToPrevious(activities, 'week', now), [activities, now]);
  const week = buckets[buckets.length - 1];
  const latest = useMemo(
    () => [...activities].sort((a, b) => b.startTime - a.startTime)[0],
    [activities]
  );
  const latestAchievement = useMemo(
    () => [...snapshot.records.achievements].sort((a, b) => b.achievedAt - a.achievedAt)[0],
    [snapshot.records.achievements]
  );
  const recordActivityIds = useMemo(
    () => new Set(snapshot.records.achievements.filter((a) => a.type === 'personal_record').map((a) => a.activityId)),
    [snapshot.records.achievements]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={NOMA_COLORS.charcoal} />}
      >
        <FadeInView>
          <View style={{ marginBottom: 20 }}>
            <Wordmark tagline />
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <View
            style={{
              backgroundColor: NOMA_COLORS.carbon,
              borderRadius: 28,
              padding: 22,
              marginBottom: 20,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, letterSpacing: 1.5, color: NOMA_COLORS.mediterranean, marginBottom: 8 }}>
              CETTE SEMAINE
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ fontFamily: FONTS.headingBold, fontSize: 52, color: '#FFFFFF' }}>{week.distanceKm.toFixed(1)}</Text>
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 16, color: NOMA_COLORS.lime, marginLeft: 6 }}>km</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 18 }}>
              {[
                ['TEMPS', StatisticsService.formatDuration(week.durationMs)],
                ['SORTIES', `${week.count}`],
                ['ALLURE', week.avgPaceMinKm ? `${StatisticsService.formatPace(week.avgPaceMinKm)}/km` : '--'],
              ].map(([label, value]) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 10, letterSpacing: 1, color: '#9AA39B' }}>{label}</Text>
                  <Text style={{ fontFamily: FONTS.headingBold, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>{value}</Text>
                </View>
              ))}
            </View>
            {activities.length > 0 && (
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#9AA39B', marginTop: 16 }}>
                {comparison.status !== 'ok' || comparison.comparison?.distance.percent == null
                  ? 'Pas encore assez de sorties pour comparer avec la semaine dernière'
                  : `${comparison.comparison.distance.percent > 0 ? '+' : ''}${comparison.comparison.distance.percent.toFixed(0)} % de distance vs mêmes jours de la semaine dernière`}
              </Text>
            )}
          </View>
        </FadeInView>

        {activities.length === 0 ? (
          <FadeInView delay={120}>
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: NOMA_COLORS.charcoal, marginBottom: 8 }}>Aucune sortie pour le moment</Text>
              <Text style={{ fontSize: 14, color: NOMA_COLORS.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
                Enregistrez votre première sortie pour suivre votre semaine, vos records et vos analyses.
              </Text>
              <Button label="Enregistrer une sortie" onPress={() => navigation.navigate('Record')} size="large" variant="action" />
            </Card>
          </FadeInView>
        ) : (
          <>
            <FadeInView delay={120}>
              <Card style={{ marginBottom: 20 }}>
                <SectionTitle title="Distance par semaine" />
                <BarChart
                  data={buckets.map((b, i) => ({
                    label: new Date(b.start).getDate().toString(),
                    value: b.distanceKm,
                    highlight: i === buckets.length - 1,
                  }))}
                  formatValue={(v) => v.toFixed(0)}
                />
                <Text style={{ fontSize: 11, color: NOMA_COLORS.textSecondary, marginTop: 4 }}>
                  Semaine commençant le (jour du mois), en km
                </Text>
              </Card>
            </FadeInView>

            {latestAchievement && (
              <FadeInView delay={160}>
                <Card
                  style={{ marginBottom: 20 }}
                  onPress={() => navigation.navigate('ActivityDetails', { activityId: latestAchievement.activityId })}
                >
                  <Badge label="Dernier succès" variant="primary" />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: NOMA_COLORS.charcoal, marginTop: 10 }}>
                    {latestAchievement.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 4 }}>
                    {latestAchievement.description} · {formatShortDate(latestAchievement.achievedAt)}
                  </Text>
                </Card>
              </FadeInView>
            )}

            <FadeInView delay={200}>
              <SectionTitle title="Dernière sortie" />
              {latest && (
                <ActivityRow
                  summary={latest}
                  hasRecord={recordActivityIds.has(latest.id)}
                  onPress={() => navigation.navigate('ActivityDetails', { activityId: latest.id })}
                />
              )}
              <Button
                label="Enregistrer une sortie"
                onPress={() => navigation.navigate('Record')}
                size="large"
                variant="action"
                style={{ marginTop: 8 }}
              />
            </FadeInView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
