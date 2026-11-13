/**
 * Activity Tracking Context
 * Manages global state for the tracking session
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Activity, GPSPoint, ActivityStats } from '../types';
import { gpsTrackingService } from '../services/GPSTrackingService';
import { activityStorageService } from '../services/ActivityStorageService';
import { StatisticsService } from '../services/StatisticsService';

interface TrackingContextType {
  // State
  currentActivity: Activity | null;
  isTracking: boolean;
  isPaused: boolean;
  lastGPSPoint: GPSPoint | null;
  error: string | null;

  // Actions
  startActivity: (name: string) => Promise<void>;
  pauseActivity: () => Promise<void>;
  resumeActivity: () => Promise<void>;
  finishActivity: () => Promise<Activity | null>;
  discardActivity: () => Promise<void>;

  // Stats (live updates)
  currentStats: ActivityStats | null;

  // History
  activities: Activity[];
  loadActivities: () => Promise<void>;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

/** Closes a pause still open at `now` (resume or finish). Activities without `pauses` stay without. */
const closeOpenPause = (pauses: Activity['pauses'], now: number): Activity['pauses'] =>
  pauses?.map((p) => (p.end === null ? { ...p, end: now } : p));

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastGPSPoint, setLastGPSPoint] = useState<GPSPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentStats, setCurrentStats] = useState<ActivityStats | null>(null);

  // Recover activity from storage on mount
  useEffect(() => {
    const recover = async () => {
      try {
        const recovered = await activityStorageService.recoverCurrentActivity();
        if (recovered && recovered.status !== 'finished') {
          setCurrentActivity(recovered);
          setIsPaused(recovered.status === 'paused');
        }
      } catch (err) {
        console.error('Error recovering activity:', err);
      }
    };

    recover();
  }, []);

  // Tick every second while recording so the duration advances even without new GPS points.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!currentActivity || !isTracking || isPaused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [currentActivity?.id, isTracking, isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update stats whenever activity, points or the clock change
  useEffect(() => {
    if (currentActivity) {
      const now = Date.now();
      const duration = now - currentActivity.startTime;

      const stats = StatisticsService.computeActivityStats(
        currentActivity.gpsPoints,
        isPaused ? currentActivity.stats.totalDuration : duration
      );

      setCurrentStats(stats);
    }
  }, [currentActivity, isPaused, tick]);

  // Save current activity periodically for crash recovery
  useEffect(() => {
    if (currentActivity && isTracking && !isPaused) {
      const interval = setInterval(() => {
        activityStorageService.saveCurrentActivity(currentActivity);
      }, 5000); // Every 5 seconds

      return () => clearInterval(interval);
    }
  }, [currentActivity, isTracking, isPaused]);

  // Called from the GPS subscription: must not depend on state (stale closure).
  // GPS is stopped on pause/finish, so no guard is needed here.
  const handleGPSUpdate = useCallback((point: GPSPoint) => {
    setCurrentActivity((prev) => {
      if (!prev) return null;

      const updatedActivity: Activity = {
        ...prev,
        gpsPoints: [...prev.gpsPoints, point],
      };

      return updatedActivity;
    });

    setLastGPSPoint(point);
  }, []);

  const handleTrackingError = useCallback((err: Error) => {
    console.error('[Tracking Error]', err);
    setError(err.message);
  }, []);

  const startActivity = useCallback(async (name: string) => {
    try {
      setError(null);

      // Request permissions
      const permResult = await gpsTrackingService.requestPermissions();
      if (!permResult.granted) {
        throw new Error(permResult.message);
      }

      // Create new activity
      const activityId = `activity_${Date.now()}`;
      const newActivity: Activity = {
        id: activityId,
        name,
        gpsPoints: [],
        stats: {
          totalDistance: 0,
          totalDuration: 0,
          movingTime: 0,
          averagePace: 0,
          currentPace: null,
          averageSpeed: 0,
          currentSpeed: null,
          elevationGain: 0,
          maxSpeed: 0,
        },
        startTime: Date.now(),
        endTime: null,
        status: 'started',
        pauses: [],
      };

      setCurrentActivity(newActivity);
      await activityStorageService.saveCurrentActivity(newActivity);

      // Start GPS tracking
      await gpsTrackingService.startTracking(handleGPSUpdate, handleTrackingError);

      setIsTracking(true);
      setIsPaused(false);
      console.log(`[Tracking] Started activity: ${name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [handleGPSUpdate, handleTrackingError]);

  const pauseActivity = useCallback(async () => {
    try {
      if (!currentActivity || !isTracking) return;

      await gpsTrackingService.stopTracking();
      gpsTrackingService.resetFilter();

      const now = Date.now();
      const pausedActivity: Activity = {
        ...currentActivity,
        status: 'paused',
        // Only activities that track pauses record a new one (older in-flight activities keep none).
        pauses: currentActivity.pauses ? [...currentActivity.pauses, { start: now, end: null }] : currentActivity.pauses,
        stats: {
          ...currentActivity.stats,
          totalDuration: now - currentActivity.startTime,
        },
      };

      setCurrentActivity(pausedActivity);
      setIsPaused(true);
      setIsTracking(false);

      await activityStorageService.saveCurrentActivity(pausedActivity);
      console.log('[Tracking] Activity paused');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [currentActivity, isTracking]);

  const resumeActivity = useCallback(async () => {
    try {
      if (!currentActivity || !isPaused) return;

      setError(null);

      // Start GPS tracking again
      await gpsTrackingService.startTracking(handleGPSUpdate, handleTrackingError);

      const resumedActivity: Activity = {
        ...currentActivity,
        status: 'started',
        pauses: closeOpenPause(currentActivity.pauses, Date.now()),
      };

      setCurrentActivity(resumedActivity);
      setIsTracking(true);
      setIsPaused(false);

      await activityStorageService.saveCurrentActivity(resumedActivity);
      console.log('[Tracking] Activity resumed');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [currentActivity, isPaused, handleGPSUpdate, handleTrackingError]);

  const finishActivity = useCallback(async (): Promise<Activity | null> => {
    try {
      if (!currentActivity) return null;

      setError(null);

      // Stop GPS tracking
      await gpsTrackingService.stopTracking();
      setIsTracking(false);
      setIsPaused(false);

      const now = Date.now();
      const finishedActivity: Activity = {
        ...currentActivity,
        endTime: now,
        status: 'finished',
        pauses: closeOpenPause(currentActivity.pauses, now),
        stats: StatisticsService.computeActivityStats(
          currentActivity.gpsPoints,
          now - currentActivity.startTime
        ),
      };

      // Save to storage
      await activityStorageService.saveActivity(finishedActivity);
      await activityStorageService.saveCurrentActivity(null);

      setCurrentActivity(null);
      setLastGPSPoint(null);
      setCurrentStats(null);

      console.log(`[Tracking] Activity finished: ${finishedActivity.id}`);
      return finishedActivity;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [currentActivity]);

  const discardActivity = useCallback(async () => {
    try {
      if (!currentActivity) return;

      await gpsTrackingService.stopTracking();

      setCurrentActivity(null);
      setIsTracking(false);
      setIsPaused(false);
      setLastGPSPoint(null);
      setCurrentStats(null);

      await activityStorageService.saveCurrentActivity(null);

      console.log('[Tracking] Activity discarded');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [currentActivity]);

  const loadActivities = useCallback(async () => {
    try {
      const loaded = await activityStorageService.getAllActivities();
      setActivities(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  return (
    <TrackingContext.Provider
      value={{
        currentActivity,
        isTracking,
        isPaused,
        lastGPSPoint,
        error,
        startActivity,
        pauseActivity,
        resumeActivity,
        finishActivity,
        discardActivity,
        currentStats,
        activities,
        loadActivities,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = () => {
  const context = useContext(TrackingContext);
  if (context === undefined) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
};
