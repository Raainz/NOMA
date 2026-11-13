/**
 * Analytics Context: exposes persisted records / segments to the UI and runs the
 * analysis after an activity is finished. Independent from GPS recording: a failure
 * here never affects tracking or saved activities.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Activity } from '../types';
import { activityStorageService } from '../services/ActivityStorageService';
import { AnalyticsRepository, AnalyticsSnapshot, ProcessResult, getAnalyticsRepository } from '../analytics/AnalyticsRepository';
import { emptyRecordsStore } from '../analytics/personalRecords';
import { emptySegmentStore } from '../analytics/segments';

interface AnalyticsContextType {
  snapshot: AnalyticsSnapshot;
  ready: boolean;
  /** Re-runs the (idempotent) backfill and reloads the stores. */
  refresh: () => Promise<void>;
  /** Analyzes a freshly finished activity. Never throws. */
  processActivity: (activity: Activity) => Promise<ProcessResult | null>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const repository: AnalyticsRepository = useMemo(
    () =>
      getAnalyticsRepository(
        () => activityStorageService.getAllActivities(),
        () => activityStorageService.listActivityIds()
      ),
    []
  );
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>({
    records: emptyRecordsStore(),
    segments: emptySegmentStore(),
  });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await repository.syncAll());
    } catch (error) {
      console.warn('[Analytics] refresh failed:', error);
    } finally {
      setReady(true);
    }
  }, [repository]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const processActivity = useCallback(
    async (activity: Activity) => {
      try {
        const result = await repository.processActivity(activity);
        setSnapshot(await repository.load());
        return result;
      } catch (error) {
        console.warn('[Analytics] processActivity failed:', error);
        return null;
      }
    },
    [repository]
  );

  return (
    <AnalyticsContext.Provider value={{ snapshot, ready, refresh, processActivity }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalytics = () => {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used within an AnalyticsProvider');
  return ctx;
};
