/**
 * Runs the upload queue while signed in: at sign-in, when the activity list changes,
 * when the app returns to the foreground and on a slow timer (backoff retries).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { activityStorageService } from '../services/ActivityStorageService';
import { countStates, SyncCounts, SyncService, SyncState, SyncStatus } from '../sync/syncQueue';
import { useAuth } from './AuthContext';
import { useSummariesContext } from './SummariesContext';

const SYNC_STATE_KEY = 'NOMA_SYNC_STATE_V1';

const syncService = new SyncService({
  storage: {
    async load() {
      try {
        const raw = await AsyncStorage.getItem(SYNC_STATE_KEY);
        return raw ? (JSON.parse(raw) as SyncState) : {};
      } catch {
        return {};
      }
    },
    async save(state) {
      await AsyncStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
    },
  },
  upload: (payload) => api.syncActivity(payload),
  listActivities: () => activityStorageService.getAllActivities(),
  listIds: () => activityStorageService.listActivityIds(),
  getActivity: (id) => activityStorageService.getActivity(id),
});

interface SyncContextType {
  counts: SyncCounts;
  syncing: boolean;
  lastError: string | null;
  /** Sync state of one activity ('pending' until it has been uploaded). */
  statusOf: (activityId: string) => SyncStatus;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const { summaries } = useSummariesContext();
  const [state, setState] = useState<SyncState>({});
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const signedIn = status === 'signedIn';

  const run = useCallback(
    async (force = false) => {
      if (!signedIn) return;
      setSyncing(true);
      try {
        const { state: next } = await syncService.run({ force });
        setState({ ...next });
        const failing = Object.values(next).find((e) => e.status !== 'synced' && e.lastError);
        setLastError(failing?.lastError ?? null);
      } finally {
        setSyncing(false);
      }
    },
    [signedIn]
  );

  // Fresh account state on sign-out; initial load + run on sign-in.
  useEffect(() => {
    if (!signedIn) {
      syncService.reset().catch(() => undefined);
      setState({});
      return;
    }
    syncService.getState().then(setState).catch(() => undefined);
    run();
  }, [signedIn, run]);

  // A new/removed finished activity triggers a pass.
  const finishedKey = summaries.map((a) => a.id).join('|');
  useEffect(() => {
    if (signedIn) run();
  }, [finishedKey, signedIn, run]);

  useEffect(() => {
    if (!signedIn) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    const timer = setInterval(() => run(), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [signedIn, run]);

  const value = useMemo<SyncContextType>(
    () => ({
      counts: countStates(state, summaries),
      syncing,
      lastError,
      statusOf: (id: string): SyncStatus => state[id]?.status ?? 'pending',
      syncNow: () => run(true),
      retryFailed: async () => {
        await syncService.retryFailed();
        await run(true);
      },
    }),
    [state, summaries, syncing, lastError, run]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
};
