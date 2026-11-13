/**
 * Activity Details: route, stats, splits, pace and elevation charts,
 * achievements and segment attempts for one finished activity.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Share, Alert } from 'react-native';
import { Activity } from '../types';
import { activityStorageService } from '../services/ActivityStorageService';
import { StatisticsService } from '../services/StatisticsService';
import { useAnalytics } from '../context/AnalyticsContext';
import { useSync } from '../context/SyncContext';
import { SyncBadge } from '../components/SyncBadge';
import { VisibilityCard } from '../components/VisibilityCard';
import { RouteMap } from '../components/RouteMap';
import { Badge, Button, Card, FadeInView, NOMA_COLORS } from '../components/UIComponents';
import { ElevationChart, LineChart } from '../components/Charts';
import { InsightEmpty, Metric, SectionTitle, formatShortDate } from '../components/Blocks';
import { prepareTrack } from '../analytics/track';
import { buildActivitySummary } from '../analytics/metrics';
import { computeSplits, elevationProfile } from '../analytics/efforts';
import { formatRecordTime } from '../analytics/personalRecords';

export const ActivityDetailsScreen: React.FC<{ route: { params: { activityId: string } }; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { activityId } = route.params;
  const { snapshot } = useAnalytics();
  const { statusOf } = useSync();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    activityStorageService
      .getActivity(activityId)
      .then((a) => {
        if (!active) return;
        if (a) setActivity(a);
        else setMissing(true);
      })
      .catch(() => active && setMissing(true));
    return () => {
      active = false;
    };
  }, [activityId]);

  const analysis = useMemo(() => {
    if (!activity) return null;
    const track = prepareTrack(activity.gpsPoints ?? []);
    return { splits: computeSplits(track, 1000), elevation: elevationProfile(track, 50) };
  }, [activity]);
  // Same function as the summary index: this activity shows the same figures on every screen.
  const summary = useMemo(() => (activity ? buildActivitySummary(activity) : null), [activity]);

  const achievements = useMemo(
    () => snapshot.records.achievements.filter((a) => a.activityId === activityId),
    [snapshot.records.achievements, activityId]
  );
  const attempts = useMemo(
    () =>
      snapshot.segments.attempts
        .filter((a) => a.activityId === activityId)
        .map((attempt) => {
          const segment = snapshot.segments.segments.find((s) => s.id === attempt.segmentId);
          const best = Math.min(
            ...snapshot.segments.attempts.filter((a) => a.segmentId === attempt.segmentId).map((a) => a.elapsedMs)
          );
          return { attempt, segment, isBest: attempt.elapsedMs === best };
        })
        .filter((x) => x.segment),
    [snapshot.segments, activityId]
  );

  if (missing || !activity || !analysis || !summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: NOMA_COLORS.textSecondary }}>{missing ? 'Activité introuvable' : 'Chargement…'}</Text>
        {missing && <Button label="Retour" onPress={() => navigation.goBack()} style={{ marginTop: 20 }} />}
      </SafeAreaView>
    );
  }

  const s = summary;
  const { splits, elevation } = analysis;
  const fastest = splits.length ? Math.min(...splits.filter((x) => !x.isPartial).map((x) => x.paceMinKm)) : null;
  const km = s.distanceM / 1000;
  const paceText = s.avgPaceMinKm !== null ? StatisticsService.formatPace(s.avgPaceMinKm) : '--';

  const share = async () => {
    try {
      await Share.share({
        message:
          `${activity.name}\n` +
          `Distance : ${StatisticsService.formatDistance(km)}\n` +
          `Temps en mouvement : ${StatisticsService.formatDuration(s.movingMs)}\n` +
          `Allure : ${paceText}/km\n\n#NOMA`,
      });
    } catch {
      Alert.alert('Erreur', "Impossible de partager l'activité");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <FadeInView>
          <Text style={{ fontSize: 28, fontWeight: '700', color: NOMA_COLORS.charcoal }}>{activity.name}</Text>
          <Text style={{ fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 4, marginBottom: 16 }}>
            {formatShortDate(activity.startTime)} ·{' '}
            {new Date(activity.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={{ marginBottom: 16, marginTop: -8 }}>
            <SyncBadge status={statusOf(activity.id)} />
          </View>
        </FadeInView>

        {achievements.length > 0 && (
          <FadeInView delay={40}>
            <Card style={{ marginBottom: 16, borderColor: NOMA_COLORS.lime, borderWidth: 2 }}>
              <Badge label="Succès" variant="primary" />
              {achievements.map((a) => (
                <View key={a.id} style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: NOMA_COLORS.charcoal }}>{a.title}</Text>
                  <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary }}>{a.description}</Text>
                </View>
              ))}
            </Card>
          </FadeInView>
        )}

        {activity.gpsPoints.length > 1 && (
          <View style={{ marginBottom: 16 }}>
            <RouteMap points={activity.gpsPoints} height={220} follow={false} />
          </View>
        )}

        <FadeInView delay={80}>
          <Card style={{ marginBottom: 16 }}>
            <Metric label="Distance" value={StatisticsService.formatDistance(km)} large />
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Metric label="Temps écoulé" value={StatisticsService.formatDuration(s.elapsedMs)} />
              <Metric label="En mouvement" value={StatisticsService.formatDuration(s.movingMs)} />
              <Metric label="Allure" value={paceText} unit="/km" />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Metric label="Vitesse" value={s.avgSpeedKmh !== null ? s.avgSpeedKmh.toFixed(1) : '--'} unit="km/h" />
              <Metric label="D+ (estimé)" value={s.elevationGainM !== null ? s.elevationGainM.toFixed(0) : '--'} unit="m" />
              <Metric label="Vitesse max" value={s.maxSpeedKmh !== null ? s.maxSpeedKmh.toFixed(1) : '--'} unit="km/h" />
            </View>
            {s.interruptionCount > 0 && (
              <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 12 }}>
                {s.interruptionCount} interruption{s.interruptionCount > 1 ? 's' : ''} détectée{s.interruptionCount > 1 ? 's' : ''} (pause ou perte GPS) :{' '}
                {StatisticsService.formatDuration(s.interruptionMs)}
              </Text>
            )}
            {s.pausedMs !== null && s.pausedMs > 0 && (
              <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 4 }}>
                Pauses enregistrées : {StatisticsService.formatDuration(s.pausedMs)}
              </Text>
            )}
          </Card>
        </FadeInView>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Splits" />
          {splits.length === 0 ? (
            <InsightEmpty message="Pas assez de données GPS pour calculer les kilomètres." />
          ) : (
            <>
              <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
                <Text style={{ width: 40, fontSize: 11, color: NOMA_COLORS.textSecondary }}>KM</Text>
                <Text style={{ flex: 1, fontSize: 11, color: NOMA_COLORS.textSecondary }}>ALLURE</Text>
                <Text style={{ width: 70, fontSize: 11, color: NOMA_COLORS.textSecondary, textAlign: 'right' }}>TEMPS</Text>
                <Text style={{ width: 50, fontSize: 11, color: NOMA_COLORS.textSecondary, textAlign: 'right' }}>D+</Text>
              </View>
              {splits.map((sp) => {
                const isFastest = fastest !== null && !sp.isPartial && sp.paceMinKm === fastest;
                return (
                  <View
                    key={sp.index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 8,
                      paddingHorizontal: 6,
                      borderRadius: 8,
                      backgroundColor: isFastest ? NOMA_COLORS.lime + '55' : 'transparent',
                    }}
                  >
                    <Text style={{ width: 34, fontWeight: '700', color: NOMA_COLORS.charcoal }}>
                      {sp.isPartial ? (sp.distanceMeters / 1000).toFixed(2) : sp.index}
                    </Text>
                    <Text style={{ flex: 1, color: NOMA_COLORS.charcoal }}>{StatisticsService.formatPace(sp.paceMinKm)}/km</Text>
                    <Text style={{ width: 70, textAlign: 'right', color: NOMA_COLORS.charcoal }}>
                      {StatisticsService.formatDuration(sp.durationMs)}
                    </Text>
                    <Text style={{ width: 50, textAlign: 'right', color: NOMA_COLORS.textSecondary }}>
                      +{sp.elevationGain.toFixed(0)}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Allure par kilomètre" />
          {splits.length < 2 ? (
            <InsightEmpty message="Il faut au moins deux kilomètres pour tracer l’allure." />
          ) : (
            <LineChart
              values={splits.map((x) => x.paceMinKm)}
              labels={splits.map((x) => (x.isPartial ? `dernier tronçon (${(x.distanceMeters / 1000).toFixed(2)} km)` : `kilomètre ${x.index}`))}
              invert
              formatValue={(v) => `${StatisticsService.formatPace(v)}/km`}
            />
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Altitude" />
          {elevation.length < 2 ? (
            <InsightEmpty message="Aucune altitude enregistrée pour cette sortie." />
          ) : (
            <ElevationChart values={elevation.map((e) => e.altitude)} />
          )}
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <SectionTitle title="Segments" />
          {attempts.length === 0 ? (
            <InsightEmpty message="Aucun segment reconnu. Les segments apparaissent quand vous répétez un parcours." />
          ) : (
            attempts.map(({ attempt, segment, isBest }) => (
              <View key={attempt.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: NOMA_COLORS.charcoal }}>{segment!.name}</Text>
                  <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary }}>
                    {(segment!.lengthMeters / 1000).toFixed(2)} km
                  </Text>
                </View>
                {isBest && <Badge label="Meilleur" variant="primary" />}
                <Text style={{ marginLeft: 10, fontWeight: '700', color: NOMA_COLORS.charcoal }}>
                  {formatRecordTime(attempt.elapsedMs)}
                </Text>
              </View>
            ))
          )}
        </Card>

        <VisibilityCard activityId={activity.id} />

        <View style={{ height: 16 }} />
        <Button label="Partager" onPress={share} variant="secondary" size="large" />
      </ScrollView>
    </SafeAreaView>
  );
};
