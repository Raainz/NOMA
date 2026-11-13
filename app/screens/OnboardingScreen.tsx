/**
 * Onboarding: 3 short steps, the last one explains why location is needed
 * and lets the user continue without granting it.
 */

import React, { useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Button, FadeInView, NOMA_COLORS, FONTS, Wordmark } from '../components/UIComponents';
import { Icon, IconName } from '../components/Icons';
import { colors } from '../theme/tokens';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'activity',
    title: 'Enregistrez chaque sortie',
    body: 'Distance, allure, dénivelé et tracé, même écran verrouillé.',
  },
  {
    icon: 'star',
    title: 'Suivez vos progrès',
    body: 'NOMA détecte vos records et compare vos efforts sur les mêmes segments.',
  },
  {
    icon: 'pin',
    title: 'Pourquoi la localisation ?',
    body: 'Votre position sert uniquement à tracer vos sorties. Elle reste sur votre téléphone. Vous pouvez continuer sans l\'autoriser, mais l\'enregistrement ne fonctionnera pas.',
  },
];

export const OnboardingScreen: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [index, setIndex] = useState(0);
  const [asking, setAsking] = useState(false);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  const finish = async (ask: boolean) => {
    if (ask) {
      setAsking(true);
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch {
        // The Profile screen shows the real permission state.
      }
      setAsking(false);
    }
    onDone();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NOMA_COLORS.background, padding: 24 }}>
      <Wordmark size={20} />
      <FadeInView key={index} style={{ flex: 1, justifyContent: 'center' }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: colors.carbon,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <Icon name={step.icon} size={32} color={colors.lime} />
        </View>
        <Text style={{ fontFamily: FONTS.headingBold, fontSize: 30, lineHeight: 36, color: colors.text }}>{step.title}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginTop: 12 }}>
          {step.body}
        </Text>
      </FadeInView>

      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={{ height: 4, flex: i === index ? 2 : 1, borderRadius: 2, backgroundColor: i === index ? colors.coral : colors.border }}
          />
        ))}
      </View>

      {last ? (
        <>
          <Button label="Autoriser la localisation" size="large" loading={asking} onPress={() => finish(true)} />
          <Button label="Plus tard" variant="secondary" size="large" onPress={() => finish(false)} style={{ marginTop: 10 }} />
        </>
      ) : (
        <>
          <Button label="Continuer" size="large" onPress={() => setIndex(index + 1)} />
          <Button label="Passer" variant="secondary" size="large" onPress={() => setIndex(STEPS.length - 1)} style={{ marginTop: 10 }} />
        </>
      )}
    </SafeAreaView>
  );
};
