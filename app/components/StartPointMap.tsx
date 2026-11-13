/**
 * Start point picker (web fallback): maps are only available on iOS / Android.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { Coordinate } from '../explorer/RouteGenerationService';
import { colors, radius } from '../theme/tokens';

export const StartPointMap: React.FC<{
  value: Coordinate | null;
  onChange: (c: Coordinate) => void;
  height?: number;
}> = ({ value, height = 220 }) => (
  <View
    style={{
      height,
      borderRadius: radius.card,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}
  >
    <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
      {value ? `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}` : 'La carte est disponible sur mobile.'}
    </Text>
  </View>
);
