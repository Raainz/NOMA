/**
 * Offline-first upload queue for finished activities.
 * Recording never depends on the network: activities are saved locally first, then uploaded here.
 * Pure logic + an injectable service, so it is fully unit-testable.
 */

import { Activity } from '../types';
import { ApiError, SyncPayload, SyncPoint, SyncResult } from '../api/client';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface SyncEntry {
  status: SyncStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  serverId?: string;
}

export type SyncState = Record<string, SyncEntry>;

export interface SyncCounts {
  pending: number;
  synced: number;
  failed: number;
}

const BASE_DELAY_MS = 15_000;
const MAX_DELAY_MS = 30 * 60_000;

export function backoffMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

/**
 * Maps a local activity to the server contract.
 * Cleans what the server would reject (negative speed/accuracy, out-of-range values, unordered points).
 * Returns null when nothing meaningful can be uploaded (fewer than 2 valid points).
 */
export function buildSyncPayload(activity: Activity): SyncPayload | null {
  if (activity.status !== 'finished' || activity.endTime == null) return null;

  const points: SyncPoint[] = activity.gpsPoints
    .filter(
      (p) =>
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude) &&
        Math.abs(p.latitude) <= 90 &&
        Math.abs(p.longitude) <= 180 &&
        Number.isFinite(p.timestamp) &&
        p.timestamp > 0
    )
    .map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude != null && p.altitude >= -1000 && p.altitude <= 10000 ? p.altitude : null,
      accuracy: p.accuracy != null && p.accuracy >= 0 ? p.accuracy : null,
      speed: p.speed != null && p.speed >= 0 ? p.speed : null,
      timestamp: Math.round(p.timestamp),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length < 2) return null;

  const stats = activity.stats;
  return {
    client_activity_id: activity.id,
    name: (activity.name || 'Sortie').trim().slice(0, 100) || 'Sortie',
    started_at: new Date(activity.startTime).toISOString(),
    ended_at: new Date(Math.max(activity.endTime, activity.startTime)).toISOString(),
    points,
    client_metrics: {
      distance_m: Math.max(0, stats.totalDistance * 1000),
      duration_ms: Math.max(0, stats.totalDuration),
      moving_time_ms: Math.max(0, stats.movingTime),
      elevation_gain_m: Math.max(0, stats.elevationGain),
    },
  };
}

export function countStates(state: SyncState, activities: Array<{ id: string; status?: string }>): SyncCounts {
  const counts: SyncCounts = { pending: 0, synced: 0, failed: 0 };
  for (const a of activities) {
    if (a.status !== undefined && a.status !== 'finished') continue;
    const s = state[a.id]?.status ?? 'pending';
    counts[s] += 1;
  }
  return counts;
}

/** Transient = worth retrying later. 4xx other than 401/408/429 are permanent for this payload. */
export function isTransient(e: unknown): boolean {
  if (!(e instanceof ApiError)) return true;
  return e.isNetwork || e.status >= 500 || e.status === 401 || e.status === 408 || e.status === 429;
}

export interface SyncStorage {
  load(): Promise<SyncState>;
  save(state: SyncState): Promise<void>;
}

export interface SyncDeps {
  storage: SyncStorage;
  upload: (payload: SyncPayload) => Promise<SyncResult>;
  listActivities: () => Promise<Activity[]>;
  /**
   * Optional lazy mode: with both provided, only activities that still need an upload are loaded
   * (instead of every activity with its GPS points on each pass).
   */
  listIds?: () => Promise<string[]>;
  getActivity?: (id: string) => Promise<Activity | null>;
  now?: () => number;
}

export class SyncService {
  private running = false;
  constructor(private deps: SyncDeps) {}

  private now() {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  async getState(): Promise<SyncState> {
    return this.deps.storage.load();
  }

  private async loadCandidates(state: SyncState, force: boolean): Promise<Activity[]> {
    const { listIds, getActivity } = this.deps;
    if (!listIds || !getActivity) return this.deps.listActivities();
    const ids = await listIds();
    const due = ids.filter((id) => {
      const entry = state[id];
      if (entry?.status === 'synced' || entry?.status === 'failed') return false;
      return force || !entry || entry.nextAttemptAt <= this.now();
    });
    const loaded: Activity[] = [];
    for (const id of due) {
      const activity = await getActivity(id);
      if (activity) loaded.push(activity);
    }
    return loaded;
  }

  /** Uploads every due activity, oldest first. Stops early when the network is down. */
  async run(options: { force?: boolean } = {}): Promise<{ state: SyncState; skipped: boolean }> {
    if (this.running) return { state: await this.deps.storage.load(), skipped: true };
    this.running = true;
    try {
      const state = await this.deps.storage.load();
      const all = await this.loadCandidates(state, options.force === true);
      const activities = all
        .filter((a) => a.status === 'finished' && a.endTime != null)
        .sort((a, b) => a.startTime - b.startTime);

      for (const activity of activities) {
        const entry = state[activity.id];
        if (entry?.status === 'synced' || entry?.status === 'failed') continue;
        if (entry && !options.force && entry.nextAttemptAt > this.now()) continue;

        const attempts = (entry?.attempts ?? 0) + 1;
        const payload = buildSyncPayload(activity);
        if (!payload) {
          state[activity.id] = { status: 'failed', attempts, nextAttemptAt: 0, lastError: 'Trace GPS insuffisante' };
          await this.deps.storage.save(state);
          continue;
        }

        try {
          const result = await this.deps.upload(payload);
          state[activity.id] = {
            status: 'synced',
            attempts,
            nextAttemptAt: 0,
            serverId: result.activity.id,
          };
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (isTransient(e)) {
            state[activity.id] = {
              status: 'pending',
              attempts,
              nextAttemptAt: this.now() + backoffMs(attempts),
              lastError: message,
            };
            await this.deps.storage.save(state);
            // Offline or server down: the rest would fail too.
            if (!(e instanceof ApiError) || e.isNetwork || e.status >= 500 || e.status === 401) break;
            continue;
          }
          state[activity.id] = { status: 'failed', attempts, nextAttemptAt: 0, lastError: message };
        }
        await this.deps.storage.save(state);
      }
      return { state, skipped: false };
    } finally {
      this.running = false;
    }
  }

  /** Puts permanently failed activities back in the queue (manual retry). */
  async retryFailed(): Promise<void> {
    const state = await this.deps.storage.load();
    for (const id of Object.keys(state)) {
      if (state[id].status === 'failed') state[id] = { status: 'pending', attempts: 0, nextAttemptAt: 0 };
    }
    await this.deps.storage.save(state);
  }

  async reset(): Promise<void> {
    await this.deps.storage.save({});
  }
}
