/**
 * Activity summaries for the whole app (derived data, see analytics/summaryIndex.ts).
 * Loaded once, refreshed whenever an activity is saved or deleted. Reads no GPS point.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { activityStorageService } from '../services/ActivityStorageService';
import { ActivitySummary } from '../analytics/metrics';

interface SummariesContextType {
  /** Finished activities, newest first. */
  summaries: ActivitySummary[];
  loading: boolean;
  /** True once the first load has completed (an empty list before that is not "no activity"). */
  ready: boolean;
  refresh: () => Promise<void>;
}

const SummariesContext = createContext<SummariesContextType | undefined>(undefined);

export const SummariesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSummaries(await activityStorageService.getSummaries());
    } catch (error) {
      console.warn('[Summaries] refresh failed:', error);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    return activityStorageService.subscribe(() => {
      refresh();
    });
  }, [refresh]);

  const value = useMemo(() => ({ summaries, loading, ready, refresh }), [summaries, loading, ready, refresh]);
  return <SummariesContext.Provider value={value}>{children}</SummariesContext.Provider>;
};

export const useSummariesContext = () => {
  const ctx = useContext(SummariesContext);
  if (!ctx) throw new Error('useSummariesContext must be used within a SummariesProvider');
  return ctx;
};
