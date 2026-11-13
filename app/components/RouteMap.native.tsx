/**
 * Route map (iOS / Android): draws the GPS track as a polyline
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { GPSPoint } from '../types';
import { NOMA_COLORS } from './UIComponents';

export const RouteMap: React.FC<{
  points: GPSPoint[];
  height?: number;
  follow?: boolean;
}> = ({ points, height = 220, follow = true }) => {
  const mapRef = useRef<MapView>(null);

  const coords = useMemo(
    () => points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [points]
  );
  const last = coords.length > 0 ? coords[coords.length - 1] : null;
  const first = coords.length > 0 ? coords[0] : null;

  useEffect(() => {
    if (!mapRef.current || coords.length === 0) return;
    if (follow) {
      mapRef.current.animateToRegion(
        { ...coords[coords.length - 1], latitudeDelta: 0.004, longitudeDelta: 0.004 },
        500
      );
    } else if (coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: false,
      });
    }
  }, [coords, follow]);

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        showsUserLocation={follow}
        userInterfaceStyle="dark"
        initialRegion={
          last
            ? { ...last, latitudeDelta: 0.004, longitudeDelta: 0.004 }
            : undefined
        }
      >
        {coords.length > 1 && (
          <Polyline coordinates={coords} strokeColor={NOMA_COLORS.coral} strokeWidth={5} />
        )}
        {!follow && first && <Marker coordinate={first} pinColor="green" />}
        {!follow && last && coords.length > 1 && <Marker coordinate={last} pinColor="red" />}
      </MapView>
    </View>
  );
};
