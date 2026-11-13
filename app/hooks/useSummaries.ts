import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAnalytics } from '../context/AnalyticsContext';
import { useSummariesContext } from '../context/SummariesContext';

/**
 * Finished activities as light summaries (no GPS points are loaded).
 * The analytics backfill is re-run on focus: it is a no-op when everything is already analyzed.
 */
export function useSummaries() {
  const { summaries, loading, ready, refresh } = useSummariesContext();
  const { refresh: refreshAnalytics } = useAnalytics();

  useFocusEffect(
    useCallback(() => {
      refreshAnalytics();
    }, [refreshAnalytics])
  );

  const reload = useCallback(async () => {
    await refresh();
    await refreshAnalytics();
  }, [refresh, refreshAnalytics]);

  return { summaries, loading, ready, refresh: reload };
}
