/**
 * Live Tracking Screen
 * Start form + dark in-run view with large, glanceable figures.
 * Tracking logic lives in TrackingContext; this screen only presents it.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { useTracking } from '../context/TrackingContext';
import { useAnalytics } from '../context/AnalyticsContext';
import { NOMA_COLORS, FONTS, Button, Card } from '../components/UIComponents';
import { Field } from '../components/System';
import { StatisticsService } from '../services/StatisticsService';
import { RouteMap } from '../components/RouteMap';
import { colors, radius } from '../theme/tokens';

const Figure: React.FC<{ label: string; value: string; unit?: string; size?: number; color?: string }> = ({
  label,
  value,
  unit,
  size = 40,
  color = colors.lime,
}) => (
  <View style={{ flex: 1 }} accessible accessibilityLabel={`${label} ${value} ${unit ?? ''}`}>
    <Text style={styles.figureLabel}>{label}</Text>
    <Text style={{ fontFamily: FONTS.headingBold, fontSize: size, lineHeight: size * 1.15, color }} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    {unit ? <Text style={styles.figureUnit}>{unit}</Text> : null}
  </View>
);

export const LiveTrackingScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    currentActivity,
    isTracking,
    isPaused,
    currentStats,
    startActivity,
    pauseActivity,
    resumeActivity,
    finishActivity,
    discardActivity,
    error,
  } = useTracking();
  const { processActivity } = useAnalytics();

  const [activityName, setActivityName] = useState('');
  const [showNameInput, setShowNameInput] = useState(!currentActivity);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    const name = activityName.trim() || 'Sortie running';
    setLoading(true);
    try {
      await startActivity(name);
      setShowNameInput(false);
    } catch (err) {
      Alert.alert('Impossible de démarrer', error || "Vérifiez l'autorisation de localisation dans l'onglet Profil.");
    } finally {
      setLoading(false);
    }
  };

  const run = async (fn: () => Promise<unknown>, failure: string) => {
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      Alert.alert('Erreur', failure);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    Alert.alert('Terminer la sortie ?', 'Votre activité sera enregistrée.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Terminer',
        onPress: async () => {
          setLoading(true);
          try {
            const finished = await finishActivity();
            if (finished) {
              // Analytics are best-effort and never block or alter the recorded activity.
              const analysis = await processActivity(finished);
              navigation.navigate('Summary', { activityId: finished.id, analysis });
            }
          } catch (err) {
            Alert.alert('Erreur', "Impossible de terminer l'activité");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleDiscard = () => {
    Alert.alert('Abandonner la sortie ?', 'Cette activité sera perdue.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: async () => {
          try {
            await discardActivity();
            setActivityName('');
            setShowNameInput(true);
          } catch (err) {
            Alert.alert('Erreur', "Impossible d'abandonner l'activité");
          }
        },
      },
    ]);
  };

  if (!currentActivity || showNameInput) {
    return (
      <SafeAreaView style={styles.lightContainer}>
        <View style={styles.formContent}>
          <Text style={styles.formTitle}>Nouvelle sortie</Text>
          <Text style={styles.formSubtitle}>Donnez un nom à votre sortie, puis lancez l'enregistrement.</Text>

          <Card style={{ marginTop: 28, marginBottom: 20 }}>
            <Field
              label="Nom de la sortie"
              value={activityName}
              onChangeText={setActivityName}
              placeholder="Sortie running"
              returnKeyType="done"
              maxLength={50}
              error={error}
            />
          </Card>

          <Button label="Démarrer" onPress={handleStart} loading={loading} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const status = isPaused ? 'En pause' : isTracking ? 'Enregistrement' : 'Arrêté';
  const noSignal = currentActivity.gpsPoints.length === 0 && isTracking;
  const duration = currentStats ? StatisticsService.formatDuration(currentStats.totalDuration) : '0:00';

  return (
    <SafeAreaView style={styles.darkContainer}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.activityName} numberOfLines={1}>
            {currentActivity.name}
          </Text>
          <View style={[styles.statusPill, isPaused && { borderColor: colors.warning }]}>
            <View style={[styles.statusDot, { backgroundColor: isPaused ? colors.warning : colors.lime }]} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>

        <View style={{ marginTop: 28 }} accessible accessibilityLabel={`Durée ${duration}`}>
          <Text style={styles.figureLabel}>Durée</Text>
          <Text style={styles.timer} numberOfLines={1} adjustsFontSizeToFit>
            {duration}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 24 }}>
          <Figure
            label="Distance"
            value={currentStats ? StatisticsService.formatDistance(currentStats.totalDistance) : '0 km'}
          />
          <Figure
            label="Allure"
            value={currentStats ? StatisticsService.formatPace(currentStats.averagePace) : '--:--'}
            unit="min/km"
          />
        </View>

        <View style={styles.secondaryRow}>
          <Figure
            label="Vitesse"
            size={24}
            color={colors.sand}
            value={currentStats ? StatisticsService.formatSpeed(currentStats.averageSpeed) : '0 km/h'}
          />
          <Figure
            label="Dénivelé (estimé)"
            size={24}
            color={colors.sand}
            value={currentStats ? currentStats.elevationGain.toFixed(0) : '0'}
            unit="m"
          />
        </View>

        <View style={{ marginTop: 20, borderRadius: radius.card, overflow: 'hidden' }}>
          <RouteMap points={currentActivity.gpsPoints} height={220} follow />
        </View>

        {noSignal ? (
          <View style={styles.notice}>
            <ActivityIndicator color={colors.lime} size="small" />
            <Text style={styles.noticeText}>Recherche du signal GPS… Dégagez-vous des bâtiments si cela dure.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.controls}>
        {!isTracking && !isPaused && (
          <Button label="Nouvelle sortie" onPress={() => setShowNameInput(true)} size="large" />
        )}

        {isTracking && !isPaused && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              label="Pause"
              onPress={() => run(pauseActivity, 'Impossible de mettre en pause')}
              loading={loading}
              variant="secondary"
              size="large"
              style={{ flex: 1 }}
            />
            <Button label="Terminer" onPress={handleFinish} loading={loading} size="large" style={{ flex: 1 }} />
          </View>
        )}

        {isPaused && (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                label="Reprendre"
                onPress={() => run(resumeActivity, 'Impossible de reprendre')}
                loading={loading}
                size="large"
                style={{ flex: 1 }}
              />
              <Button label="Terminer" onPress={handleFinish} loading={loading} variant="secondary" size="large" style={{ flex: 1 }} />
            </View>
            <Button label="Abandonner" onPress={handleDiscard} variant="danger" size="large" style={{ marginTop: 12 }} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  lightContainer: { flex: 1, backgroundColor: NOMA_COLORS.background },
  darkContainer: { flex: 1, backgroundColor: colors.runBackground },
  formContent: { flex: 1, padding: 24, justifyContent: 'center' },
  formTitle: { fontFamily: FONTS.headingBold, fontSize: 30, color: colors.text },
  formSubtitle: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginTop: 8 },
  activityName: { flex: 1, fontFamily: FONTS.heading, fontSize: 18, color: colors.sand, marginRight: 12 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lime,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: colors.sand },
  figureLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inactive,
  },
  figureUnit: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: colors.inactive, marginTop: 2 },
  timer: { fontFamily: FONTS.headingBold, fontSize: 72, lineHeight: 80, color: colors.sand },
  secondaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,241,232,0.12)',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: radius.control,
    backgroundColor: 'rgba(245,241,232,0.08)',
  },
  noticeText: { flex: 1, fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: colors.sand },
  controls: { padding: 20, paddingTop: 8 },
});
