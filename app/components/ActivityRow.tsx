import React from 'react';
import { View, Text } from 'react-native';
import { ActivitySummary } from '../analytics/metrics';
import { StatisticsService } from '../services/StatisticsService';
import { Card, NOMA_COLORS } from './UIComponents';
import { SyncBadge } from './SyncBadge';
import { useSync } from '../context/SyncContext';
import { fr } from '../i18n/fr';

/**
 * One activity in a list. Distance, moving time and pace all come from the shared summary,
 * so the same activity shows the same figures on every screen.
 */
export const ActivityRow: React.FC<{ summary: ActivitySummary; onPress: () => void; hasRecord?: boolean }> = ({
  summary,
  onPress,
  hasRecord,
}) => {
  const date = new Date(summary.startTime);
  const { statusOf } = useSync();
  const sync = statusOf(summary.id);
  const distance = StatisticsService.formatDistance(summary.distanceM / 1000);
  const time = StatisticsService.formatDuration(summary.movingMs);
  const pace = summary.avgPaceMinKm !== null ? `${StatisticsService.formatPace(summary.avgPaceMinKm)}/km` : '--';
  return (
    <Card
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
      accessibilityLabel={`${summary.name}, ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}, ${distance}, ${time} en mouvement, allure ${pace}${hasRecord ? ', record personnel' : ''}, ${fr.sync[sync].toLowerCase()}`}
    >
      <View
        style={{
          backgroundColor: NOMA_COLORS.backgroundLight,
          borderRadius: 14,
          paddingVertical: 10,
          minWidth: 56,
          alignItems: 'center',
          marginRight: 14,
        }}
      >
        <Text style={{ fontSize: 10, color: NOMA_COLORS.textSecondary, fontWeight: '600' }}>
          {date.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: NOMA_COLORS.charcoal }}>{date.getDate()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: NOMA_COLORS.charcoal, flexShrink: 1 }} numberOfLines={1}>
            {summary.name}
          </Text>
          {hasRecord ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: NOMA_COLORS.lime, marginLeft: 8 }} />
          ) : null}
        </View>
        <Text style={{ fontSize: 13, color: NOMA_COLORS.textSecondary, marginTop: 4 }}>
          {distance}  ·  {time}  ·  {pace}
        </Text>
        <View style={{ marginTop: 6 }}>
          <SyncBadge status={sync} />
        </View>
      </View>
    </Card>
  );
};
