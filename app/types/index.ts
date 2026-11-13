/**
 * NOMA GPS Activity Tracking - Type Definitions
 * Core types for the entire application
 */

export interface GPSPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number; // Unix timestamp in milliseconds
  speed: number | null; // m/s
}

export interface ActivityStats {
  totalDistance: number; // kilometers
  totalDuration: number; // milliseconds
  movingTime: number; // milliseconds
  averagePace: number; // min/km (decimal)
  currentPace: number | null; // min/km
  averageSpeed: number; // km/h
  currentSpeed: number | null; // km/h
  elevationGain: number; // meters
  maxSpeed: number; // km/h
}

export interface Activity {
  id: string;
  name: string;
  gpsPoints: GPSPoint[];
  stats: ActivityStats;
  startTime: number; // Unix timestamp in milliseconds
  endTime: number | null; // null if activity is ongoing
  status: 'started' | 'paused' | 'finished';
  notes?: string;
  /**
   * Pause intervals (ms timestamps), recorded from the version that introduced them.
   * Absent on older activities: their pauses are unknown and are never inferred.
   */
  pauses?: Array<{ start: number; end: number | null }>;
}

export interface ActivityTrackingState {
  currentActivity: Activity | null;
  isTracking: boolean;
  isPaused: boolean;
  lastGPSPoint: GPSPoint | null;
}

export interface LocationPermission {
  granted: boolean;
  message: string;
}

export interface TrackingConfig {
  updateInterval: number; // milliseconds between GPS updates
  minAccuracy: number; // minimum GPS accuracy in meters
  distanceFilter: number; // minimum distance between points in meters
}
