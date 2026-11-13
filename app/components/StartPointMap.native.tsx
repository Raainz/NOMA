/**
 * Start point picker map (iOS / Android): tap to choose the start point.
 */

import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Coordinate } from '../explorer/RouteGenerationService';

export const StartPointMap: React.FC<{
  value: Coordinate | null;
  onChange: (c: Coordinate) => void;
  height?: number;
}> = ({ value, onChange, height = 220 }) => {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    if (value) ref.current?.animateToRegion({ ...value, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 400);
  }, [value]);

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={
          value
            ? { ...value, latitudeDelta: 0.03, longitudeDelta: 0.03 }
            : { latitude: 46.6, longitude: 2.4, latitudeDelta: 12, longitudeDelta: 12 }
        }
        onPress={(e) => onChange(e.nativeEvent.coordinate)}
      >
        {value && <Marker coordinate={value} pinColor="orange" />}
      </MapView>
    </View>
  );
};
