/**
 * The share card itself (spec 13.1): name, distance, time, pace, stylised route, NOMA mark.
 * No date, no map, no place name. Drawn with react-native-svg so it needs no image service.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens';
import { CardStats, RoutePath } from './shareCard';

export type CardFormat = 'story' | 'square';
export type CardTheme = 'dark' | 'light';

export const CARD_RATIO: Record<CardFormat, number> = { story: 16 / 9, square: 1 };

export const ShareCard: React.FC<{
  width: number;
  format: CardFormat;
  theme: CardTheme;
  name: string;
  stats: CardStats;
  /** Null = "sans tracé" or nothing to draw. */
  route: RoutePath | null;
}> = ({ width, format, theme, name, stats, route }) => {
  const height = Math.round(width * CARD_RATIO[format]);
  const u = width / 360; // one design unit
  const dark = theme === 'dark';
  const bg = dark ? colors.carbon : colors.sand;
  const ink = dark ? colors.sand : colors.carbon;
  const soft = dark ? 'rgba(245,241,232,0.65)' : colors.textSecondary;
  const accent = dark ? colors.lime : colors.carbon;
  const routeColor = colors.coral;

  const pad = 24 * u;
  const routeH = Math.round(height * (format === 'story' ? 0.42 : 0.4));
  const routeW = width - 2 * pad;

  return (
    <View style={{ width, height, backgroundColor: bg, padding: pad, justifyContent: 'space-between' }}>
      <Text style={{ fontFamily: fonts.headingBold, fontSize: 18 * u, letterSpacing: 4 * u, color: ink }}>NOMA</Text>

      {route ? (
        <Svg width={routeW} height={routeH} accessibilityLabel="Tracé de la course">
          <Path d={route.d} stroke={routeColor} strokeWidth={4 * u} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={route.start.x} cy={route.start.y} r={5 * u} fill={accent} />
          <Circle cx={route.end.x} cy={route.end.y} r={5 * u} fill={routeColor} />
        </Svg>
      ) : (
        <View style={{ height: routeH / 3 }} />
      )}

      <View>
        <Text numberOfLines={2} style={{ fontFamily: fonts.heading, fontSize: 17 * u, color: soft, marginBottom: 6 * u }}>
          {name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 64 * u, lineHeight: 70 * u, color: accent }}>{stats.distance}</Text>
          <Text style={{ fontFamily: fonts.headingMedium, fontSize: 20 * u, color: ink, marginLeft: 6 * u }}>{stats.distanceUnit}</Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12 * u, gap: 28 * u }}>
          <Stat u={u} label="Temps" value={stats.time} ink={ink} soft={soft} />
          {stats.pace ? <Stat u={u} label="Allure /km" value={stats.pace} ink={ink} soft={soft} /> : null}
        </View>
      </View>
    </View>
  );
};

const Stat: React.FC<{ u: number; label: string; value: string; ink: string; soft: string }> = ({ u, label, value, ink, soft }) => (
  <View>
    <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12 * u, color: soft }}>{label}</Text>
    <Text style={{ fontFamily: fonts.headingBold, fontSize: 26 * u, color: ink }}>{value}</Text>
  </View>
);
