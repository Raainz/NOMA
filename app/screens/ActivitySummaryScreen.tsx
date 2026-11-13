/**
 * Activity Summary Screen
 * Displays detailed summary after finishing an activity
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Share,
  Alert,
} from 'react-native';
import { Activity } from '../types';
import { activityStorageService } from '../services/ActivityStorageService';
import { StatisticsService } from '../services/StatisticsService';
import { RouteMap } from '../components/RouteMap';
import { NOMA_COLORS, FONTS, Button, StatDisplay, Card, Badge, Divider } from '../components/UIComponents';
import { Icon } from '../components/Icons';
import { ProcessResult } from '../analytics/AnalyticsRepository';
import { formatRecordTime } from '../analytics/personalRecords';
import { buildActivitySummary } from '../analytics/metrics';

interface SummaryScreenProps {
  route: {
    params: {
      activityId: string;
      analysis?: ProcessResult | null;
    };
  };
  navigation: any;
}

export const ActivitySummaryScreen: React.FC<SummaryScreenProps> = ({ route, navigation }) => {
  const { activityId } = route.params;
  // Achievements are celebrated once: keep them locally, then clear the route param.
  const [analysis] = useState(route.params.analysis);
  useEffect(() => {
    if (route.params.analysis) navigation.setParams({ analysis: undefined });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        const loaded = await activityStorageService.getActivity(activityId);
        if (loaded) {
          setActivity(loaded);
        } else {
          setError('Activité introuvable');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement de l\'activité');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [activityId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: NOMA_COLORS.text }}>Chargement de l’activité…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !activity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: NOMA_COLORS.danger }}>{error || 'Activité introuvable'}</Text>
          <Button
            label="Retour"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 24 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Same function as the summary index: identical figures on every screen.
  const summary = buildActivitySummary(activity);
  if (!summary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: NOMA_COLORS.text }}>Activité non terminée</Text>
        </View>
      </SafeAreaView>
    );
  }
  const km = summary.distanceM / 1000;
  const paceText = summary.avgPaceMinKm !== null ? StatisticsService.formatPace(summary.avgPaceMinKm) : '--';

  const handleShare = async () => {
    try {
      const message = `Je viens de terminer une sortie avec NOMA !\n\n` +
        `${activity.name}\n` +
        `Distance : ${StatisticsService.formatDistance(km)}\n` +
        `Temps en mouvement : ${StatisticsService.formatDuration(summary.movingMs)}\n` +
        `Allure : ${paceText}/km\n` +
        (summary.elevationGainM !== null ? `D+ (estimé) : ${summary.elevationGainM.toFixed(0)} m\n` : '') +
        `\n#NOMA`;

      await Share.share({
        message,
        title: `${activity.name} - NOMA`,
      });
    } catch (err) {
      Alert.alert('Erreur', "Impossible de partager l'activité");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer la sortie ?',
      'This action cannot be undone.',
      [
        { text: 'Annuler', onPress: () => {} },
        {
          text: 'Supprimer',
          onPress: async () => {
            try {
              await activityStorageService.deleteActivity(activityId);
              navigation.navigate('Main', { screen: 'Activities' });
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de supprimer la sortie');
            }
          },
        },
      ]
    );
  };

  const duration = StatisticsService.formatDuration(summary.elapsedMs);
  const movingTime = StatisticsService.formatDuration(summary.movingMs);
  const distance = StatisticsService.formatDistance(km);
  const pace = paceText;
  const speed = summary.avgSpeedKmh !== null ? StatisticsService.formatSpeed(summary.avgSpeedKmh) : '--';

  const startDate = new Date(activity.startTime);
  const endDate = activity.endTime ? new Date(activity.endTime) : new Date();
  const dateStr = startDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = startDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Badge label="Sortie terminée" variant="success" />
          <Text style={styles.activityName}>{activity.name}</Text>
          <Text style={styles.dateTime}>
            {dateStr} • {timeStr}
          </Text>
        </View>

        {/* New achievements from the analytics engine */}
        {analysis && (analysis.records.achievements.length > 0 || analysis.segments.personalBests.length > 0) && (
          <Card style={{ marginBottom: 16, backgroundColor: NOMA_COLORS.carbon, borderColor: NOMA_COLORS.lime, borderWidth: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="star" size={20} color={NOMA_COLORS.lime} />
              <Text style={{ fontSize: 13, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.8, color: NOMA_COLORS.lime }}>
                NOUVEAUX RECORDS
              </Text>
            </View>
            {analysis.records.achievements.map((a) => (
              <View key={a.id} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 18, fontFamily: FONTS.headingBold, color: NOMA_COLORS.sand }}>{a.title}</Text>
                <Text style={{ fontSize: 13, color: NOMA_COLORS.sage }}>{a.description}</Text>
              </View>
            ))}
            {analysis.segments.personalBests.map((pb) => (
              <View key={pb.attempt.id} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 18, fontFamily: FONTS.headingBold, color: NOMA_COLORS.sand }}>
                  Meilleur temps : {pb.segment.name}
                </Text>
                <Text style={{ fontSize: 13, color: NOMA_COLORS.sage }}>
                  {formatRecordTime(pb.attempt.elapsedMs)} (avant : {formatRecordTime(pb.previousBestMs)})
                </Text>
              </View>
            ))}
          </Card>
        )}

        {activity.gpsPoints.length > 1 && (
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <RouteMap points={activity.gpsPoints} height={240} follow={false} />
          </View>
        )}

        {/* Main Statistics */}
        <Card style={styles.mainStatsCard}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <StatDisplay label="Distance" value={distance} highlight />
          </View>
          <Divider color={NOMA_COLORS.surfaceLight} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Temps écoulé</Text>
              <Text style={styles.statValue}>{duration}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Allure</Text>
              <Text style={styles.statValue}>{pace}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>Vitesse</Text>
              <Text style={styles.statValue}>{speed}</Text>
            </View>
          </View>
        </Card>

        {/* Detailed Statistics */}
        <Card>
          <Text style={styles.sectionTitle}>Détail des statistiques</Text>
          <Divider color={NOMA_COLORS.surfaceLight} />

          {[
            { label: 'Temps en mouvement', value: movingTime },
            { label: 'Distance', value: distance },
            { label: 'Allure moyenne', value: pace },
            { label: 'Vitesse max', value: summary.maxSpeedKmh !== null ? `${summary.maxSpeedKmh.toFixed(1)} km/h` : '--' },
            { label: 'D+ (estimé)', value: summary.elevationGainM !== null ? `${summary.elevationGainM.toFixed(0)} m` : '--' },
            { label: 'Points GPS', value: `${activity.gpsPoints.length}` },
          ].map((stat, index) => (
            <View key={index}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{stat.label}</Text>
                <Text style={styles.detailValue}>{stat.value}</Text>
              </View>
              {index < 5 && <Divider color={NOMA_COLORS.surfaceLight} />}
            </View>
          ))}
        </Card>

        {/* GPS Tracking Info */}
        <Card style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Suivi GPS</Text>
          <Divider color={NOMA_COLORS.surfaceLight} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Précision GPS</Text>
            <Text style={styles.detailValue}>
              {activity.gpsPoints.length > 0
                ? `${(activity.gpsPoints.reduce((sum, p) => sum + (p.accuracy || 0), 0) / activity.gpsPoints.length).toFixed(1)} m`
                : 'N/D'}
            </Text>
          </View>
          <Divider color={NOMA_COLORS.surfaceLight} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Statut de la session</Text>
            <Badge label="Terminée" variant="primary" />
          </View>
        </Card>

        {/* Activity Notes */}
        {activity.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Divider color={NOMA_COLORS.surfaceLight} />
            <Text style={styles.notesText}>{activity.notes}</Text>
          </Card>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Button
          label="Analyse complète"
          onPress={() => navigation.navigate('ActivityDetails', { activityId })}
          variant="primary"
          size="large"
          style={{ marginBottom: 12 }}
        />
        <Button
          label="Partager"
          onPress={handleShare}
          variant="secondary"
          size="large"
          style={{ marginBottom: 12 }}
        />
        <Button
          label="Voir l’historique"
          onPress={() => navigation.navigate('Main', { screen: 'Activities' })}
          variant="secondary"
          size="large"
          style={{ marginBottom: 12 }}
        />
        <Button
          label="Supprimer"
          onPress={handleDelete}
          variant="danger"
          size="large"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NOMA_COLORS.background,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    marginBottom: 24,
  },
  activityName: {
    fontSize: 32,
    fontWeight: '700',
    color: NOMA_COLORS.primary,
    marginTop: 12,
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 12,
    color: NOMA_COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  mainStatsCard: {
    marginBottom: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: NOMA_COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: NOMA_COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: NOMA_COLORS.primary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: NOMA_COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: NOMA_COLORS.text,
  },
  infoCard: {
    marginBottom: 16,
  },
  notesCard: {
    marginBottom: 16,
  },
  notesText: {
    fontSize: 14,
    color: NOMA_COLORS.text,
    lineHeight: 22,
    paddingTop: 12,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
});
