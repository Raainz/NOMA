/**
 * Activités hub: segmented switch between history, analytics, records and segments.
 * Each section reuses its existing screen.
 */

import React, { useState } from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { NOMA_COLORS } from '../components/UIComponents';
import { Chip } from '../components/System';
import { ActivityHistoryScreen } from './ActivityHistoryScreen';
import { PerformanceScreen } from './PerformanceScreen';
import { RecordsScreen } from './RecordsScreen';
import { SegmentsScreen } from './SegmentsScreen';

const SECTIONS = [
  { key: 'history', label: 'Historique' },
  { key: 'insights', label: 'Analyses' },
  { key: 'records', label: 'Records' },
  { key: 'segments', label: 'Segments' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export const ActivitiesHubScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [section, setSection] = useState<SectionKey>('history');
  const Inner: React.ComponentType<any> =
    section === 'history'
      ? ActivityHistoryScreen
      : section === 'insights'
        ? PerformanceScreen
        : section === 'records'
          ? RecordsScreen
          : SegmentsScreen;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <View style={{ paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {SECTIONS.map((s) => (
            <Chip key={s.key} label={s.label} selected={section === s.key} onPress={() => setSection(s.key)} />
          ))}
        </ScrollView>
      </View>
      <View style={{ flex: 1 }}>
        <Inner navigation={navigation} />
      </View>
    </SafeAreaView>
  );
};
