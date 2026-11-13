/**
 * GPS Tracking Service
 * Handles location permission, GPS data collection, and tracking lifecycle
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { GPSPoint, LocationPermission, TrackingConfig } from '../types';
import {
  BACKGROUND_TRACKING_TASK,
  setBackgroundLocationListener,
} from './BackgroundLocationTask';

const DEFAULT_CONFIG: TrackingConfig = {
  updateInterval: 1000, // 1 second
  minAccuracy: 50, // 50 meters
  distanceFilter: 5, // 5 meters minimum between points
};

export class GPSTrackingService {
  private subscription: Location.LocationSubscription | null = null;
  private config: TrackingConfig;
  private lastFilteredPoint: GPSPoint | null = null;

  constructor(config: Partial<TrackingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Request GPS permissions from the device
   */
  async requestPermissions(): Promise<LocationPermission> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        return {
          granted: true,
          message: 'Location permission granted',
        };
      }

      return {
        granted: false,
        message: 'Location permission denied by user',
      };
    } catch (error) {
      return {
        granted: false,
        message: `Permission error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Request background location permission (iOS 11+ and Android)
   */
  async requestBackgroundPermissions(): Promise<LocationPermission> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();

      if (status === 'granted') {
        return {
          granted: true,
          message: 'Background location permission granted',
        };
      }

      return {
        granted: false,
        message: 'Background location permission denied',
      };
    } catch (error) {
      return {
        granted: false,
        message: `Background permission error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if location permission is granted
   */
  async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Filter GPS point based on accuracy and distance from last point
   * Removes inaccurate and redundant points
   */
  private filterGPSPoint(location: Location.LocationObject): GPSPoint | null {
    // Check accuracy threshold (first fix is accepted up to 100m so the UI can start)
    const maxAccuracy = this.lastFilteredPoint === null ? 100 : this.config.minAccuracy;
    if (
      location.coords.accuracy !== null &&
      location.coords.accuracy > maxAccuracy
    ) {
      return null; // GPS accuracy too poor, skip this point
    }

    const newPoint: GPSPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
      speed: location.coords.speed,
    };

    // Check minimum distance filter
    if (this.lastFilteredPoint !== null) {
      const latDiff = newPoint.latitude - this.lastFilteredPoint.latitude;
      const lonDiff = newPoint.longitude - this.lastFilteredPoint.longitude;
      const distanceMeters = Math.sqrt(
        Math.pow(latDiff * 111000, 2) + // Rough conversion: 1 degree ≈ 111 km
        Math.pow(lonDiff * 111000 * Math.cos(newPoint.latitude * Math.PI / 180), 2)
      );

      if (distanceMeters < this.config.distanceFilter) {
        return null; // Too close to last point, skip
      }
    }

    this.lastFilteredPoint = newPoint;
    return newPoint;
  }

  /**
   * Start tracking GPS location with callback
   * Returns a subscription that can be used to stop tracking
   */
  async startTracking(
    onLocationUpdate: (point: GPSPoint) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      // Try background tracking first (dev/production builds). Fails in Expo Go and on web.
      const backgroundStarted = await this.tryStartBackgroundTracking(onLocationUpdate);

      // Fallback: foreground-only updates (works in Expo Go)
      if (!backgroundStarted) {
        this.subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: this.config.updateInterval,
            distanceInterval: 0,
          },
          (location) => {
            const filteredPoint = this.filterGPSPoint(location);
            if (filteredPoint) {
              onLocationUpdate(filteredPoint);
            }
          }
        );
      }

      console.log(
        `[GPSTrackingService] Started tracking (${backgroundStarted ? 'background' : 'foreground'})`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError(err);
      throw err;
    }
  }

  /**
   * Start background location updates. Returns false when unsupported
   * (Expo Go, web, background permission denied).
   */
  private async tryStartBackgroundTracking(
    onLocationUpdate: (point: GPSPoint) => void
  ): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const bg = await this.requestBackgroundPermissions();
      if (!bg.granted) return false;

      setBackgroundLocationListener((locations) => {
        for (const location of locations) {
          const filteredPoint = this.filterGPSPoint(location);
          if (filteredPoint) {
            onLocationUpdate(filteredPoint);
          }
        }
      });

      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: this.config.updateInterval,
        distanceInterval: 0,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'NOMA Running',
          notificationBody: 'Tracking your activity...',
        },
      });
      return true;
    } catch (error) {
      setBackgroundLocationListener(null);
      console.log('[GPSTrackingService] Background tracking unavailable, using foreground');
      return false;
    }
  }

  /**
   * Stop GPS tracking
   */
  async stopTracking(): Promise<void> {
    try {
      if (this.subscription) {
        this.subscription.remove();
        this.subscription = null;
      }

      setBackgroundLocationListener(null);
      if (
        Platform.OS !== 'web' &&
        (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false))
      ) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      }
      this.lastFilteredPoint = null;

      console.log('[GPSTrackingService] Stopped tracking');
    } catch (error) {
      console.warn('[GPSTrackingService] Error stopping tracking:', error);
    }
  }

  /**
   * Get current device location (single shot)
   */
  async getCurrentLocation(): Promise<GPSPoint | null> {
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        throw new Error('Location permission not granted');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
        speed: location.coords.speed,
      };
    } catch (error) {
      console.error('[GPSTrackingService] Error getting current location:', error);
      return null;
    }
  }

  /**
   * Geocode coordinates to address (if needed for summary)
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (result.length > 0) {
        const address = result[0];
        return `${address.city || address.region || ''}, ${address.country || ''}`.trim();
      }

      return null;
    } catch (error) {
      console.warn('[GPSTrackingService] Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Reset the filter state (call when resuming after pause)
   */
  resetFilter(): void {
    this.lastFilteredPoint = null;
  }

  /**
   * Update tracking configuration
   */
  updateConfig(config: Partial<TrackingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const gpsTrackingService = new GPSTrackingService();
