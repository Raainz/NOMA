/**
 * Personal Records: best efforts per distance with previous value and history.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import { useSummaries } from '../hooks/useSummaries';
import { useAnalytics } from '../context/AnalyticsContext';
import { Badge, Button, Card, FadeInView, NOMA_COLORS } from '../components/UIComponents';
import { InsightEmpty, ScreenTitle, formatShortDate } from '../components/Blocks';
import { StatisticsService } from '../services/StatisticsService';
import {
  LONGEST_KEY,
  PR_DISTANCES,
  currentRecords,
  formatRecordTime,
  recordHistory,
} from '../analytics/personalRecords';

export const RecordsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  useSummaries(); // keeps analytics fresh on focus
  const { snapshot } = useAnalytics();
  const [expanded, setExpanded] = useState<string | null>(null);

  const records = useMemo(() => currentRecords(snapshot.records), [snapshot.records]);
  const hasAny = Object.keys(records).length > 0;

  const rows = [
    ...PR_DISTANCES.map((d) => ({ key: `best_${d.key}`, label: d.label, longest: false })),
    { key: LONGEST_KEY, label: 'Plus longue sortie', longest: true },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <ScreenTitle title="Records" subtitle="Vos meilleurs efforts, calculés sur des distances exactes" />

        <Button
          label="Segments"
          variant="secondary"
          onPress={() => navigation.navigate('Segments')}
          style={{ marginBottom: 16 }}
        />

        {!hasAny && (
          <Card style={{ marginBottom: 16 }}>
            <InsightEmpty message="Aucun record pour le moment. Terminez une sortie d’au moins 1 km pour établir vos premiers records." />
          </Card>
        )}

        {rows.map((row, i) => {
          const record = records[row.key];
          const history = recordHistory(snapshot.records, row.key);
          const open = expanded === row.key;
          return (
            <FadeInView key={row.key} delay={i * 30}>
              <Card
                style={{ marginBottom: 12, borderColor: record ? NOMA_COLORS.lime : NOMA_COLORS.greige }}
                onPress={record ? () => setExpanded(open ? null : row.key) : undefined}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: NOMA_COLORS.charcoal }}>{row.label}</Text>
                    {record ? (
                      <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 2 }}>
                        {formatShortDate(record.achievedAt)}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary, marginTop: 2 }}>Pas encore atteint</Text>
                    )}
                  </View>
                  {record && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: NOMA_COLORS.charcoal }}>
                        {row.longest ? StatisticsService.formatDistance(record.value / 1000) : formatRecordTime(record.value)}
                      </Text>
                      {record.previousValue !== null && record.improvement !== null && (
                        <Text style={{ fontSize: 11, color: NOMA_COLORS.textSecondary }}>
                          avant{' '}
                          {row.longest
                            ? StatisticsService.formatDistance(record.previousValue / 1000)
                            : formatRecordTime(record.previousValue)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {open && record && (
                  <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: NOMA_COLORS.greige + '80', paddingTop: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: NOMA_COLORS.textSecondary, marginBottom: 6 }}>
                      HISTORIQUE
                    </Text>
                    {[...history].reverse().map((h) => (
                      <View key={h.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={{ color: NOMA_COLORS.textSecondary, fontSize: 13 }}>{formatShortDate(h.achievedAt)}</Text>
                        <Text style={{ color: NOMA_COLORS.charcoal, fontWeight: '600', fontSize: 13 }}>
                          {row.longest ? StatisticsService.formatDistance(h.value / 1000) : formatRecordTime(h.value)}
                        </Text>
                      </View>
                    ))}
                    <View style={{ flexDirection: 'row', marginTop: 10, alignItems: 'center' }}>
                      <Badge label="Record" variant="primary" />
                      <Text
                        onPress={() => navigation.navigate('ActivityDetails', { activityId: record.activityId })}
                        style={{ marginLeft: 12, fontSize: 13, fontWeight: '600', color: NOMA_COLORS.charcoal, textDecorationLine: 'underline' }}
                      >
                        Voir la sortie
                      </Text>
                    </View>
                  </View>
                )}
              </Card>
            </FadeInView>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};
