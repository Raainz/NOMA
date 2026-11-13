/**
 * Activity History: chronological list with date and distance filters.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, SafeAreaView, RefreshControl, Pressable } from 'react-native';
import { useSummaries } from '../hooks/useSummaries';
import { useAnalytics } from '../context/AnalyticsContext';
import { Card, EmptyState, NOMA_COLORS } from '../components/UIComponents';
import { ActivityRow } from '../components/ActivityRow';
import { Metric, ScreenTitle } from '../components/Blocks';
import { StatisticsService } from '../services/StatisticsService';
import { filterActivities, startOfMonth, startOfWeek, summarize } from '../analytics/performance';

type PeriodKey = 'all' | 'week' | 'month' | 'year';
type DistanceKey = 'all' | 'short' | 'mid' | 'long';

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'all', label: 'Tout' },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois-ci' },
  { key: 'year', label: 'Cette année' },
];
const DISTANCES: Array<{ key: DistanceKey; label: string; minKm?: number; maxKm?: number }> = [
  { key: 'all', label: 'Toutes distances' },
  { key: 'short', label: '< 5 km', maxKm: 4.999 },
  { key: 'mid', label: '5 - 10 km', minKm: 5, maxKm: 10 },
  { key: 'long', label: '> 10 km', minKm: 10.001 },
];

const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <Pressable
    onPress={onPress}
    style={{
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      marginRight: 8,
      backgroundColor: active ? NOMA_COLORS.charcoal : NOMA_COLORS.surface,
      borderWidth: 1,
      borderColor: active ? NOMA_COLORS.charcoal : NOMA_COLORS.greige,
    }}
  >
    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? NOMA_COLORS.offWhite : NOMA_COLORS.charcoal }}>{label}</Text>
  </Pressable>
);

export const ActivityHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { summaries: activities, loading, refresh } = useSummaries();
  const { snapshot } = useAnalytics();
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [distance, setDistance] = useState<DistanceKey>('all');

  const recordIds = useMemo(
    () => new Set(snapshot.records.achievements.filter((a) => a.type === 'personal_record').map((a) => a.activityId)),
    [snapshot.records.achievements]
  );

  const visible = useMemo(() => {
    const now = Date.now();
    const from =
      period === 'week'
        ? startOfWeek(now)
        : period === 'month'
          ? startOfMonth(now)
          : period === 'year'
            ? new Date(new Date(now).getFullYear(), 0, 1).getTime()
            : null;
    const d = DISTANCES.find((x) => x.key === distance)!;
    return filterActivities(activities, { from, minKm: d.minKm ?? null, maxKm: d.maxKm ?? null }).sort(
      (a, b) => b.startTime - a.startTime
    );
  }, [activities, period, distance]);

  const totals = useMemo(() => summarize(visible), [visible]);

  const header = (
    <View style={{ padding: 20, paddingBottom: 4 }}>
      <ScreenTitle title="Historique" subtitle="Vos sorties, de la plus récente à la plus ancienne" />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={PERIODS}
        keyExtractor={(p) => p.key}
        renderItem={({ item }) => <Chip label={item.label} active={period === item.key} onPress={() => setPeriod(item.key)} />}
        style={{ marginBottom: 10, flexGrow: 0 }}
      />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={DISTANCES}
        keyExtractor={(p) => p.key}
        renderItem={({ item }) => <Chip label={item.label} active={distance === item.key} onPress={() => setDistance(item.key)} />}
        style={{ marginBottom: 16, flexGrow: 0 }}
      />
      {visible.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row' }}>
            <Metric label="Sorties" value={`${totals.count}`} />
            <Metric label="Distance" value={totals.distanceKm.toFixed(1)} unit="km" />
            <Metric label="Temps en mouvement" value={StatisticsService.formatDuration(totals.durationMs)} />
          </View>
        </Card>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <FlatList
        data={visible}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <ActivityRow
              summary={item}
              hasRecord={recordIds.has(item.id)}
              onPress={() => navigation.navigate('ActivityDetails', { activityId: item.id })}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
            {activities.length === 0 ? (
              <EmptyState
                title="Aucune sortie pour le moment"
                description="Enregistrez votre première sortie pour commencer votre historique."
                action={{ label: 'Enregistrer une sortie', onPress: () => navigation.navigate('Record') }}
              />
            ) : (
              <Text style={{ textAlign: 'center', color: NOMA_COLORS.textSecondary }}>Aucune sortie ne correspond à ces filtres.</Text>
            )}
          </View>
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={NOMA_COLORS.charcoal} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
};
