/**
 * Preview and share the card of a finished activity (spec 13.1).
 * Image capture and sharing need two Expo packages: `npx expo install react-native-view-shot expo-sharing`.
 * Without them the screen still works and falls back to sharing the figures as text.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Share, Switch, Text, View, useWindowDimensions } from 'react-native';
import { Activity } from '../types';
import { activityStorageService } from '../services/ActivityStorageService';
import { buildActivitySummary } from '../analytics/metrics';
import { Button, FONTS, NOMA_COLORS } from '../components/UIComponents';
import { Chip } from '../components/System';
import { CARD_RATIO, CardFormat, CardTheme, ShareCard } from '../share/ShareCard';
import { cardStats, projectRoute } from '../share/shareCard';

/** Optional native modules, loaded only when sharing so the app still starts without them. */
function loadShareModules(): { captureRef: any; shareAsync: any } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { captureRef } = require('react-native-view-shot');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sharing = require('expo-sharing');
    return captureRef && Sharing?.shareAsync ? { captureRef, shareAsync: Sharing.shareAsync } : null;
  } catch {
    return null;
  }
}

const OUTPUT_WIDTH = 1080;

export const ShareCardScreen: React.FC<{ route: { params: { activityId: string } }; navigation: any }> = ({ route }) => {
  const { activityId } = route.params;
  const { width: screenWidth } = useWindowDimensions();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [format, setFormat] = useState<CardFormat>('story');
  const [theme, setTheme] = useState<CardTheme>('dark');
  const [withRoute, setWithRoute] = useState(true);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    let active = true;
    activityStorageService.getActivity(activityId).then((a) => active && setActivity(a ?? null)).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activityId]);

  const summary = useMemo(() => (activity ? buildActivitySummary(activity) : null), [activity]);
  const previewWidth = Math.min(screenWidth - 40, format === 'story' ? 280 : 340);
  const route = useMemo(() => {
    if (!activity || !withRoute) return null;
    const w = previewWidth - 2 * 24 * (previewWidth / 360);
    return projectRoute(activity.gpsPoints ?? [], w, Math.round(previewWidth * CARD_RATIO[format] * (format === 'story' ? 0.42 : 0.4)), 12);
  }, [activity, withRoute, previewWidth, format]);

  if (!activity || !summary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: NOMA_COLORS.textSecondary }}>Chargement…</Text>
      </SafeAreaView>
    );
  }

  const stats = cardStats(summary);

  const share = async () => {
    setBusy(true);
    try {
      const mods = loadShareModules();
      if (!mods) {
        // Fallback: the same figures as text. No date, no place.
        await Share.share({ message: `${activity.name}\n${stats.distance} km · ${stats.time}${stats.pace ? ` · ${stats.pace}/km` : ''}\n\n#NOMA` });
        return;
      }
      const uri = await mods.captureRef(cardRef, {
        format: 'png',
        quality: 1,
        width: OUTPUT_WIDTH,
        height: Math.round(OUTPUT_WIDTH * CARD_RATIO[format]),
        result: 'tmpfile',
      });
      await mods.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Partager ma sortie' });
    } catch {
      Alert.alert('Erreur', "Impossible de partager la carte");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, alignItems: 'center' }}>
        <View ref={cardRef} collapsable={false} style={{ borderRadius: 16, overflow: 'hidden' }}>
          <ShareCard width={previewWidth} format={format} theme={theme} name={activity.name} stats={stats} route={route} />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Chip label="Story 9:16" selected={format === 'story'} onPress={() => setFormat('story')} />
          <Chip label="Carré 1:1" selected={format === 'square'} onPress={() => setFormat('square')} />
          <Chip label="Sombre" selected={theme === 'dark'} onPress={() => setTheme('dark')} />
          <Chip label="Clair" selected={theme === 'light'} onPress={() => setTheme('light')} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 14, color: NOMA_COLORS.text }}>Afficher le tracé</Text>
          <Switch value={withRoute} onValueChange={setWithRoute} accessibilityLabel="Afficher le tracé" />
        </View>

        <View style={{ width: '100%', marginTop: 24 }}>
          <Button label="Partager" size="large" loading={busy} onPress={share} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
