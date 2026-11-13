/**
 * Route map (web/default fallback: no native map available)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { GPSPoint } from '../types';
import { NOMA_COLORS } from './UIComponents';

export const RouteMap: React.FC<{
  points: GPSPoint[];
  height?: number;
  follow?: boolean;
}> = ({ height = 220 }) => (
  <View
    style={{
      height,
      borderRadius: 16,
      backgroundColor: NOMA_COLORS.surface,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Text style={{ color: NOMA_COLORS.textSecondary, fontSize: 12 }}>
      Map available on iOS / Android
    </Text>
  </View>
);
