/**
 * Statistical Calculations Service
 * Handles distance, pace, speed, elevation calculations
 */

import { GPSPoint, ActivityStats } from '../types';
import { getDistance, getCenter } from 'geolib';

export class StatisticsService {
  /**
   * Calculate great-circle distance between two GPS points using Haversine formula
   */
  static calculateDistance(point1: GPSPoint, point2: GPSPoint): number {
    // Returns distance in kilometers
    const distanceInMeters = getDistance(
      { latitude: point1.latitude, longitude: point1.longitude },
      { latitude: point2.latitude, longitude: point2.longitude }
    );
    return distanceInMeters / 1000;
  }

  /**
   * Calculate total distance from all GPS points
   */
  static calculateTotalDistance(points: GPSPoint[]): number {
    if (points.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += this.calculateDistance(points[i - 1], points[i]);
    }
    return totalDistance;
  }

  /**
   * Calculate elevation gain from altitude data
   * Filters out small variations and GPS noise
   */
  static calculateElevationGain(
    points: GPSPoint[],
    minAltitudeChange: number = 2 // meters threshold
  ): number {
    let elevationGain = 0;

    for (let i = 1; i < points.length; i++) {
      const prevAlt = points[i - 1].altitude;
      const currentAlt = points[i].altitude;

      if (prevAlt !== null && currentAlt !== null) {
        const altDiff = currentAlt - prevAlt;
        if (altDiff > minAltitudeChange) {
          elevationGain += altDiff;
        }
      }
    }

    return elevationGain;
  }

  /**
   * Calculate pace in min/km from distance and duration
   */
  static calculatePace(distanceKm: number, durationMs: number): number | null {
    if (distanceKm === 0 || durationMs === 0) return null;

    const durationHours = durationMs / (1000 * 60 * 60);
    const speedKmH = distanceKm / durationHours;

    if (speedKmH === 0) return null;

    // Pace = 60 / speed(km/h) = minutes per kilometer
    return 60 / speedKmH;
  }

  /**
   * Calculate current pace from recent GPS points
   */
  static calculateCurrentPace(
    recentPoints: GPSPoint[],
    timeWindowMs: number = 10000 // 10 seconds window
  ): number | null {
    if (recentPoints.length < 2) return null;

    const now = recentPoints[recentPoints.length - 1].timestamp;
    const pointsInWindow = recentPoints.filter(p => now - p.timestamp <= timeWindowMs);

    if (pointsInWindow.length < 2) return null;

    const distance = this.calculateTotalDistance(pointsInWindow);
    const duration = pointsInWindow[pointsInWindow.length - 1].timestamp - pointsInWindow[0].timestamp;

    return this.calculatePace(distance, duration);
  }

  /**
   * Calculate speed from GPS velocity (if available) or compute from points
   */
  static calculateAverageSpeed(
    distanceKm: number,
    durationMs: number
  ): number {
    if (durationMs === 0) return 0;
    const durationHours = durationMs / (1000 * 60 * 60);
    return distanceKm / durationHours;
  }

  /**
   * Find maximum speed from GPS points
   */
  static findMaxSpeed(points: GPSPoint[]): number {
    let maxSpeed = 0;

    for (const point of points) {
      if (point.speed !== null) {
        const speedKmH = point.speed * 3.6; // Convert m/s to km/h
        maxSpeed = Math.max(maxSpeed, speedKmH);
      }
    }

    return maxSpeed;
  }

  /**
   * Calculate moving time (excludes pauses)
   * Uses speed threshold: if speed > 0.1 m/s, it's considered moving
   */
  static calculateMovingTime(
    points: GPSPoint[],
    speedThreshold: number = 0.1 // m/s
  ): number {
    let movingTime = 0;

    for (let i = 1; i < points.length; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];
      const timeDiff = currentPoint.timestamp - prevPoint.timestamp;

      // If we have speed data, use it; otherwise estimate from distance
      if (currentPoint.speed !== null && currentPoint.speed > speedThreshold) {
        movingTime += timeDiff;
      } else if (prevPoint.speed !== null && prevPoint.speed > speedThreshold) {
        movingTime += timeDiff;
      }
    }

    return movingTime;
  }

  /**
   * Generate comprehensive activity statistics
   */
  static computeActivityStats(
    points: GPSPoint[],
    totalDurationMs: number
  ): ActivityStats {
    const totalDistance = this.calculateTotalDistance(points);
    const movingTime = this.calculateMovingTime(points);
    const averagePace = this.calculatePace(totalDistance, movingTime) || 0;
    const elevationGain = this.calculateElevationGain(points);
    const maxSpeed = this.findMaxSpeed(points);
    const averageSpeed = this.calculateAverageSpeed(totalDistance, movingTime);

    // Get current pace from last few points
    const recentPoints = points.slice(-5); // Last 5 points
    const currentPace = this.calculateCurrentPace(recentPoints);

    // Get current speed from last point
    let currentSpeed: number | null = null;
    if (points.length > 0 && points[points.length - 1].speed !== null) {
      currentSpeed = (points[points.length - 1].speed || 0) * 3.6; // m/s to km/h
    }

    return {
      totalDistance,
      totalDuration: totalDurationMs,
      movingTime,
      averagePace,
      currentPace,
      averageSpeed,
      currentSpeed,
      elevationGain,
      maxSpeed,
    };
  }

  /**
   * Format pace for display (e.g., "5'30\"" for 5 minutes 30 seconds)
   */
  static formatPace(paceMinPerKm: number | null): string {
    if (paceMinPerKm === null || !isFinite(paceMinPerKm)) return '--:--';

    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);

    return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
  }

  /**
   * Format speed for display (e.g., "12.5 km/h")
   */
  static formatSpeed(speedKmH: number | null): string {
    if (speedKmH === null || !isFinite(speedKmH)) return '--';
    return `${speedKmH.toFixed(1)} km/h`;
  }

  /**
   * Format distance for display (e.g., "5.42 km")
   */
  static formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
      return `${(distanceKm * 1000).toFixed(0)} m`;
    }
    return `${distanceKm.toFixed(2)} km`;
  }

  /**
   * Format duration for display (e.g., "1:23:45")
   */
  static formatDuration(durationMs: number): string {
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
