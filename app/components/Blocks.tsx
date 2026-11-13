/**
 * Small shared layout blocks for the new screens.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { NOMA_COLORS, FONTS, AccentBar } from './UIComponents';

export const ScreenTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <View style={{ marginBottom: 24 }}>
    <Text style={{ fontFamily: FONTS.heading, fontSize: 30, color: NOMA_COLORS.carbon, letterSpacing: -0.5 }}>{title}</Text>
    <AccentBar style={{ marginTop: 8 }} />
    {subtitle ? <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: NOMA_COLORS.textSecondary, marginTop: 10 }}>{subtitle}</Text> : null}
  </View>
);

export const SectionTitle: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
    <Text style={{ fontFamily: FONTS.heading, fontSize: 16, color: NOMA_COLORS.carbon }}>{title}</Text>
    {right}
  </View>
);

export const Metric: React.FC<{ label: string; value: string; unit?: string; large?: boolean }> = ({
  label,
  value,
  unit,
  large,
}) => (
  <View style={{ flex: 1 }}>
    <Text style={{ fontSize: 11, fontWeight: '600', color: NOMA_COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
      {label}
    </Text>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
      <Text style={{ fontFamily: FONTS.headingBold, fontSize: large ? 34 : 20, color: NOMA_COLORS.charcoal }}>{value}</Text>
      {unit ? <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary, marginLeft: 4 }}>{unit}</Text> : null}
    </View>
  </View>
);

/** Percent change chip; `betterWhenLower` is for pace. Shows nothing without a comparable base. */
export const DeltaText: React.FC<{ percent: number | null; betterWhenLower?: boolean; suffix?: string }> = ({
  percent,
  betterWhenLower,
  suffix = 'vs période précédente',
}) => {
  if (percent === null) return <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary }}>Pas de période comparable</Text>;
  const improved = betterWhenLower ? percent < 0 : percent > 0;
  const sign = percent > 0 ? '+' : '';
  return (
    <Text style={{ fontSize: 12, color: NOMA_COLORS.textSecondary }}>
      <Text style={{ fontWeight: '700', color: improved ? NOMA_COLORS.charcoal : NOMA_COLORS.textSecondary }}>
        {sign}
        {percent.toFixed(0)} %
      </Text>{' '}
      {suffix}
    </Text>
  );
};

export const InsightEmpty: React.FC<{ message: string }> = ({ message }) => (
  <View style={{ paddingVertical: 16 }}>
    <Text style={{ fontSize: 13, color: NOMA_COLORS.textSecondary, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
  </View>
);

export const formatDay = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export const formatShortDate = (ts: number) =>
  new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
